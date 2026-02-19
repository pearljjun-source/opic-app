import { useState, useEffect, useCallback } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { getMySubscription, checkFeatureAccess, getRemainingQuota } from '@/services/billing';
import type { Subscription, SubscriptionPlan } from '@/lib/types';

// ============================================================================
// useSubscription — 구독 상태 + Feature Gating
//
// 사용법:
//   const { plan, subscription, checkAccess, getQuota, isLoading } = useSubscription();
//
//   // AI 피드백 접근 체크
//   const { allowed } = await checkAccess('ai_feedback');
//   if (!allowed) { Alert.alert('유료 플랜 필요', ...); }
//
//   // 학생 쿼터 체크
//   const { remaining } = await getQuota('students');
//   if (remaining <= 0) { Alert.alert('한도 도달', ...); }
// ============================================================================

export function useSubscription() {
  const { isAuthenticated, orgRole, currentOrg } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    // org 기반 구독 조회: currentOrg가 있으면 org_id 사용, 없으면 user_id 폴백
    const orgId = currentOrg?.id;

    getMySubscription(orgId).then(({ data }) => {
      if (data) {
        setSubscription(data.subscription);
        setPlan(data.plan);
      }
      setIsLoading(false);
    });
  }, [isAuthenticated, orgRole, currentOrg]);

  /** 구독 정보 새로고침 */
  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    const orgId = currentOrg?.id;
    const { data } = await getMySubscription(orgId);
    if (data) {
      setSubscription(data.subscription);
      setPlan(data.plan);
    }
    setIsLoading(false);
  }, [isAuthenticated, currentOrg]);

  /** 기능 접근 체크 (ai_feedback, tts) — check_org_entitlement RPC 사용 */
  const checkAccess = useCallback(async (feature: 'ai_feedback' | 'tts') => {
    return checkFeatureAccess(feature);
  }, []);

  /** 쿼터 체크 (students, scripts) — check_org_entitlement RPC 사용 */
  const getQuota = useCallback(async (quotaType: 'students' | 'scripts') => {
    return getRemainingQuota(quotaType);
  }, []);

  /** 현재 플랜 키 (free면 null) */
  const planKey = plan?.plan_key || null;

  /** 구독 활성 여부 */
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';

  return {
    subscription,
    plan,
    planKey,
    isActive,
    isLoading,
    checkAccess,
    getQuota,
    refresh,
  };
}

export default useSubscription;
