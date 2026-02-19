import { supabase } from '@/lib/supabase';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';
import { safeParse } from 'valibot';
import { BillingKeySchema, PlanUpdateSchema } from '@/lib/validations';
import type {
  SubscriptionPlan,
  Subscription,
  PaymentRecord,
  SubscriptionStats,
} from '@/lib/types';

// ============================================================================
// Billing 서비스 — 구독/결제
// ============================================================================

// ============================================================================
// 공개 (사용자용)
// ============================================================================

/** 활성 구독 플랜 목록 조회 */
export async function getSubscriptionPlans(): Promise<{
  data: SubscriptionPlan[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return { data: null, error: classifyError(error, { resource: 'plan' }) };
  return { data: data as SubscriptionPlan[], error: null };
}

/** 현재 사용자의 구독 정보 + 플랜 조회 (개인 또는 조직 기반) */
export async function getMySubscription(orgId?: string): Promise<{
  data: { subscription: Subscription; plan: SubscriptionPlan } | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  let query = supabase
    .from('subscriptions')
    .select('*, subscription_plans(*)')
    .in('status', ['active', 'trialing', 'past_due']);

  if (orgId) {
    // 조직 기반 구독 조회 (owner)
    query = query.eq('organization_id', orgId);
  } else {
    // 개인 기반 구독 조회 (레거시 호환)
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query.single();

  if (error) {
    // 구독 없음은 에러가 아님
    if (error.code === 'PGRST116') {
      return { data: null, error: null };
    }
    return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  }

  const { subscription_plans: plan, ...subscription } = data as any;
  return {
    data: {
      subscription: subscription as Subscription,
      plan: plan as SubscriptionPlan,
    },
    error: null,
  };
}

/** 빌링키 발급 + 첫 결제 (Edge Function 호출) */
export async function issueBillingKey(
  planKey: string,
  authKey: string,
  orgId: string
): Promise<{ data: { subscriptionId: string } | null; error: Error | null }> {
  // Valibot 검증
  const result = safeParse(BillingKeySchema, { planKey, authKey });
  if (!result.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  if (!orgId) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await supabase.functions.invoke('billing-key', {
    body: { planKey: result.output.planKey, authKey: result.output.authKey, orgId },
  });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  }

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'subscription' }) };
  }

  return { data: { subscriptionId: data?.subscriptionId || '' }, error: null };
}

/** 구독 취소 (기간 만료 시 종료) */
export async function cancelSubscription(
  subscriptionId: string
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  if (!data) return { data: null, error: new AppError('NF_SUBSCRIPTION') };

  return { data: { success: true }, error: null };
}

/** 결제 이력 조회 */
export async function getPaymentHistory(params?: {
  limit?: number;
  offset?: number;
}): Promise<{
  data: PaymentRecord[] | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await supabase
    .from('payment_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(params?.limit || 20);

  if (error) return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  return { data: data as PaymentRecord[], error: null };
}

/** 플랜 기능 접근 체크 (check_org_entitlement RPC 사용) */
export async function checkFeatureAccess(feature: 'ai_feedback' | 'tts'): Promise<{
  allowed: boolean;
  planKey: string | null;
  reason?: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, planKey: null };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'check_org_entitlement',
    { p_feature_key: feature }
  );

  if (error) {
    if (__DEV__) console.warn('[AppError] check_org_entitlement:', error.message);
    return { allowed: false, planKey: null };
  }

  if (data?.error) {
    return { allowed: false, planKey: null };
  }

  return {
    allowed: data?.allowed === true,
    planKey: data?.plan_key || null,
    reason: data?.reason,
  };
}

/** 남은 쿼터 체크 (check_org_entitlement RPC 사용) */
export async function getRemainingQuota(quotaType: 'students' | 'scripts'): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  const featureKey = quotaType === 'students' ? 'max_students' : 'max_scripts';

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, used: 0, limit: 0, remaining: 0 };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'check_org_entitlement',
    { p_feature_key: featureKey }
  );

  if (error) {
    if (__DEV__) console.warn('[AppError] check_org_entitlement:', error.message);
    // Free 기본값
    const defaultLimits = { students: 3, scripts: 5 };
    return { allowed: true, used: 0, limit: defaultLimits[quotaType], remaining: defaultLimits[quotaType] };
  }

  if (data?.error) {
    const defaultLimits = { students: 3, scripts: 5 };
    return { allowed: true, used: 0, limit: defaultLimits[quotaType], remaining: defaultLimits[quotaType] };
  }

  return {
    allowed: data?.allowed === true,
    used: data?.used ?? 0,
    limit: data?.limit ?? 0,
    remaining: data?.remaining ?? 0,
  };
}

// ============================================================================
// Admin 전용
// ============================================================================

/** 구독 통계 (MRR, churn, 플랜별 분포) */
export async function adminGetSubscriptionStats(): Promise<{
  data: SubscriptionStats | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_get_subscription_stats'
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'subscription' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'subscription' }) };
  }

  // RPC 필드명 → TypeScript 타입 매핑
  const mrr = data.mrr ?? 0;
  const stats: SubscriptionStats = {
    total_subscribers: data.total_active ?? 0,
    mrr,
    arr: mrr * 12,
    churn_rate: 0, // RPC에서 미제공 — 추후 RPC에 추가 시 매핑
    plan_distribution: Array.isArray(data.plans_distribution) ? data.plans_distribution : [],
  };

  return { data: stats, error: null };
}

/** 플랜 수정 */
export async function adminUpdatePlan(
  planId: string,
  updates: Record<string, unknown>
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  // Valibot 검증
  const result = safeParse(PlanUpdateSchema, updates);
  if (!result.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_update_plan',
    {
      p_plan_id: planId,
      p_updates: result.output,
    }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'plan' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'plan' }) };
  }

  return { data: { success: true }, error: null };
}

/** 전체 결제 이력 조회 (admin) */
export async function adminGetPaymentHistory(params?: {
  userId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  data: PaymentRecord[] | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  let query = supabase
    .from('payment_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params?.limit || 50);

  if (params?.userId) {
    query = query.eq('user_id', params.userId);
  }
  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  return { data: data as PaymentRecord[], error: null };
}
