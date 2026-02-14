import { useState, useEffect, useCallback } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { canTeach } from '@/lib/permissions';
import { getMySubscription, getRemainingQuota, checkFeatureAccess } from '@/services/billing';
import type { Subscription, SubscriptionPlan } from '@/lib/types';

// ============================================================================
// useSubscription — 구독 상태 + Feature Gating
//
// 사용법:
//   const { plan, subscription, checkAccess, getQuota, isLoading } = useSubscription();
//
//   // AI 피드백 접근 체크
//   const { allowed } = await checkAccess('ai_feedback');
//   if (!allowed) { showUpgradeModal(); }
//
//   // 학생 쿼터 체크
//   const { remaining } = await getQuota('students');
//   if (remaining <= 0) { showUpgradeModal(); }
// ============================================================================

export function useSubscription() {
  const { isAuthenticated, orgRole, currentOrg, role } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isTeacher = canTeach(orgRole) || role === 'teacher';

  useEffect(() => {
    if (!isAuthenticated || !isTeacher) {
      setIsLoading(false);
      return;
    }

    // owner: 조직 기반 구독 조회, teacher: 개인 기반 (레거시 호환)
    const orgId = orgRole === 'owner' && currentOrg ? currentOrg.id : undefined;

    getMySubscription(orgId).then(({ data }) => {
      if (data) {
        setSubscription(data.subscription);
        setPlan(data.plan);
      }
      setIsLoading(false);
    });
  }, [isAuthenticated, isTeacher, orgRole, currentOrg]);

  /** 구독 정보 새로고침 */
  const refresh = useCallback(async () => {
    if (!isAuthenticated || !isTeacher) return;
    setIsLoading(true);
    const orgId = orgRole === 'owner' && currentOrg ? currentOrg.id : undefined;
    const { data } = await getMySubscription(orgId);
    if (data) {
      setSubscription(data.subscription);
      setPlan(data.plan);
    }
    setIsLoading(false);
  }, [isAuthenticated, isTeacher, orgRole, currentOrg]);

  /** 기능 접근 체크 (ai_feedback, tts) */
  const checkAccess = useCallback(async (feature: 'ai_feedback' | 'tts') => {
    return checkFeatureAccess(feature);
  }, []);

  /** 쿼터 체크 (students, scripts) */
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
