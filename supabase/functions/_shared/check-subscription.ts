// _shared/check-subscription.ts
// Edge Function 공통: 구독 기반 entitlement 체크
//
// 로직: userId → org_members → subscriptions → plan → feature
// 구독 없음/org 없음 → free 기본값 (차단 아님, 기능별 판단)

interface EntitlementResult {
  allowed: boolean;
  planKey: string;
  orgId: string | null;
  reason?: string;
}

// Free 플랜 기본값
const FREE_DEFAULTS: Record<string, boolean> = {
  ai_feedback: false,
  tts: false,
};

/**
 * Edge Function에서 사용하는 entitlement 체크
 * DB RPC(check_org_entitlement)의 간소화 버전
 */
export async function checkOrgEntitlement(
  supabaseAdmin: any,
  userId: string,
  feature: string
): Promise<EntitlementResult> {
  // 1. 사용자의 가장 높은 권한 org 조회
  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('role', { ascending: true }) // owner < student < teacher (alphabetical)
    .limit(1);

  // org 멤버십 정렬: owner 우선 (alphabetical로 owner가 먼저)
  // 정확한 우선순위를 위해 수동 정렬
  let bestMembership = null;
  if (membership && membership.length > 0) {
    const { data: allMemberships } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (allMemberships && allMemberships.length > 0) {
      const roleOrder: Record<string, number> = { owner: 1, teacher: 2, student: 3 };
      allMemberships.sort((a: any, b: any) =>
        (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99)
      );
      bestMembership = allMemberships[0];
    }
  }

  if (!bestMembership) {
    return {
      allowed: FREE_DEFAULTS[feature] ?? false,
      planKey: 'free',
      orgId: null,
      reason: 'NO_ORG',
    };
  }

  const orgId = bestMembership.organization_id;

  // 2. org의 활성 구독 + 플랜 조회
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('id, status, plan_id, subscription_plans(*)')
    .eq('organization_id', orgId)
    .in('status', ['active', 'trialing', 'past_due'])
    .limit(1)
    .single();

  if (!sub || !sub.subscription_plans) {
    return {
      allowed: FREE_DEFAULTS[feature] ?? false,
      planKey: 'free',
      orgId,
      reason: 'NO_SUBSCRIPTION',
    };
  }

  const plan = sub.subscription_plans as any;

  // 3. feature별 체크
  if (feature === 'ai_feedback') {
    return {
      allowed: plan.ai_feedback_enabled === true,
      planKey: plan.plan_key,
      orgId,
      reason: plan.ai_feedback_enabled ? undefined : 'FEATURE_NOT_AVAILABLE',
    };
  }

  if (feature === 'tts') {
    return {
      allowed: plan.tts_enabled === true,
      planKey: plan.plan_key,
      orgId,
      reason: plan.tts_enabled ? undefined : 'FEATURE_NOT_AVAILABLE',
    };
  }

  return {
    allowed: false,
    planKey: plan.plan_key,
    orgId,
    reason: 'UNKNOWN_FEATURE',
  };
}
