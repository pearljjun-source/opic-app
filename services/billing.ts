import { supabase, invokeFunction } from '@/lib/supabase';
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
  orgId: string,
  billingCycle: 'monthly' | 'yearly' = 'monthly'
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

  const { data, error } = await invokeFunction<{ subscriptionId: string }>(
    'billing-key',
    { planKey: result.output.planKey, authKey: result.output.authKey, orgId, billingCycle },
  );

  if (error) {
    // 타임아웃/네트워크 에러: 결제는 성공했을 수 있음 (웹훅이 reconciliation 처리)
    // 사용자에게 "결제 확인 중" 안내 후 구독 상태 재조회 권장
    const errMsg = error.message || '';
    if (errMsg.includes('timeout') || errMsg.includes('network') || errMsg.includes('Failed to fetch')) {
      return {
        data: null,
        error: new AppError('NETWORK_TIMEOUT'),
      };
    }
    return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  }

  return { data: { subscriptionId: data?.subscriptionId || '' }, error: null };
}

/** 결제 수단 변경 (빌링키 재발급) */
export async function updateBillingKey(
  authKey: string,
  orgId: string
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  if (!authKey || !orgId) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data, error } = await invokeFunction<{ success: boolean }>(
    'update-billing-key',
    { authKey, orgId },
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  }

  return { data: { success: true }, error: null };
}

/** 플랜 변경 (업그레이드: 일할 결제, 다운그레이드: 다음 갱신 시 적용) */
export async function changePlan(
  newPlanKey: string,
  orgId: string
): Promise<{
  data: { success: boolean; type: 'upgrade' | 'downgrade'; proratedAmount?: number } | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  if (!newPlanKey || !orgId) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data, error } = await invokeFunction<{
    success: boolean;
    type: 'upgrade' | 'downgrade';
    proratedAmount?: number;
  }>('change-plan', { newPlanKey, orgId });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  }

  return { data: data || null, error: null };
}

/** 구독 취소 (기간 만료 시 종료) */
export async function cancelSubscription(
  subscriptionId: string
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  // org 기반 구독도 해지되도록: user_id 또는 org owner 여부로 필터
  // RLS가 접근 제어를 담당하므로 subscriptionId만으로 조회 후 권한 검증
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, user_id, organization_id')
    .eq('id', subscriptionId)
    .single();

  if (!sub) return { data: null, error: new AppError('NF_SUBSCRIPTION') };

  // 권한 검증: 본인 구독이거나 org owner인 경우만 허용
  if (sub.user_id !== user.id && sub.organization_id) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', sub.organization_id)
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .is('deleted_at', null)
      .single();

    if (!membership) return { data: null, error: new AppError('PERM_UNAUTHORIZED') };
  } else if (sub.user_id !== user.id) {
    return { data: null, error: new AppError('PERM_UNAUTHORIZED') };
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  if (!data) return { data: null, error: new AppError('NF_SUBSCRIPTION') };

  return { data: { success: true }, error: null };
}

/** 취소 리텐션 플로우: 사유 기록 + 취소/다운그레이드 실행 */
export async function submitCancellationFlow(params: {
  subscriptionId: string;
  orgId: string;
  reason: string;
  detail?: string;
  offerShown?: string;
  offerAccepted: boolean;
  action: 'canceled' | 'downgraded' | 'retained';
}): Promise<{ data: { success: boolean; action: string } | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  // 1. cancellation_feedback 기록
  const { error: feedbackError } = await (supabase as any)
    .from('cancellation_feedback')
    .insert({
      organization_id: params.orgId,
      subscription_id: params.subscriptionId,
      user_id: user.id,
      reason: params.reason,
      detail: params.detail || null,
      offer_shown: params.offerShown || null,
      offer_accepted: params.offerAccepted,
      final_action: params.action,
    });

  if (feedbackError) {
    if (__DEV__) console.warn('[AppError] cancellation_feedback insert:', feedbackError.message);
  }

  // 2. 최종 액션 실행
  if (params.action === 'canceled') {
    const result = await cancelSubscription(params.subscriptionId);
    if (result.error) return { data: null, error: result.error };
    return { data: { success: true, action: 'canceled' }, error: null };
  }

  if (params.action === 'downgraded') {
    // Free 플랜으로 다운그레이드 (다음 갱신 시 적용)
    const result = await changePlan('free', params.orgId);
    if (result.error) return { data: null, error: result.error };
    return { data: { success: true, action: 'downgraded' }, error: null };
  }

  // retained: 사용자가 제안을 수락하고 취소 안 함
  return { data: { success: true, action: 'retained' }, error: null };
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
export async function checkFeatureAccess(feature: 'ai_feedback' | 'tts' | 'translation'): Promise<{
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
    // RPC 미존재(마이그레이션 미적용) 또는 네트워크 에러 → 허용 폴백
    // 실제 권한 확인은 Edge Function 서버에서 수행 (이중 차단 방지)
    if (__DEV__) console.warn('[AppError] check_org_entitlement:', error.message);
    return { allowed: true, planKey: null };
  }

  if (data?.error) {
    // RPC 내부 에러 (예: UNKNOWN_FEATURE) → 허용 폴백
    if (__DEV__) console.warn('[AppError] check_org_entitlement data.error:', data.error);
    return { allowed: true, planKey: null };
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

/** 관리자 환불 처리 (request-refund Edge Function 호출) */
export async function adminRequestRefund(params: {
  paymentId: string;
  reason: string;
  forceRefund?: boolean;
}): Promise<{
  data: { success: boolean; refundAmount: number } | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  if (!params.paymentId || !params.reason) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data, error } = await invokeFunction<{
    success: boolean;
    refundAmount: number;
  }>('request-refund', {
    paymentId: params.paymentId,
    reason: params.reason,
    forceRefund: params.forceRefund || false,
  });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  }

  return { data: data || null, error: null };
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
