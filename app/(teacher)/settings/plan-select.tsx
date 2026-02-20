import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { getSubscriptionPlans, issueBillingKey } from '@/services/billing';
import { getUserMessage } from '@/lib/errors';
import { requestTossBillingAuth, isTossConfigured, buildPaymentUrls } from '@/lib/toss';
import type { SubscriptionPlan } from '@/lib/types';

const PLAN_ORDER = ['free', 'solo', 'pro', 'academy'];

export default function PlanSelectScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    authKey?: string;
    customerKey?: string;
    planKey?: string;
    paymentStatus?: string;
    code?: string;
    message?: string;
  }>();

  const { user, currentOrg, orgRole, isAuthenticated, _profileVerified } = useAuth();
  const { planKey: currentPlanKey, refresh: refreshSubscription } = useSubscription();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 콜백 중복 처리 방지
  const callbackProcessed = useRef(false);

  const isOwner = orgRole === 'owner';

  // 플랜 목록 로드
  useEffect(() => {
    getSubscriptionPlans().then(({ data }) => {
      if (data) setPlans(data);
      setIsLoading(false);
    });
  }, []);

  // ────────────────────────────────────────────────────────────
  // Toss 결제 콜백 처리 (웹: 리다이렉트 후 URL 파라미터로 authKey 수신)
  //
  // Toss 리다이렉트 → 앱 리로드 → auth 초기화 → 이 컴포넌트 마운트
  // auth가 완전히 초기화된 후에만 billingKey 발급 진행
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    // 콜백 파라미터가 없거나, 이미 처리했거나, 처리 중이면 무시
    if (!params.authKey || !params.planKey || callbackProcessed.current || isProcessing) return;

    // auth 초기화 대기 (Toss 리다이렉트 후 앱이 리로드되므로)
    if (!isAuthenticated || !_profileVerified) return;

    // org 정보 필요
    if (!currentOrg?.id) return;

    callbackProcessed.current = true;
    processPaymentCallback(params.authKey, params.planKey, currentOrg.id);
  }, [params.authKey, params.planKey, isAuthenticated, _profileVerified, currentOrg, isProcessing]);

  // 결제 실패 콜백
  useEffect(() => {
    if (params.paymentStatus === 'fail') {
      setError(params.message || '결제가 취소되었습니다.');
    }
  }, [params.paymentStatus, params.message]);

  // 결제 완료 처리
  const processPaymentCallback = async (authKey: string, planKey: string, orgId: string) => {
    setIsProcessing(true);
    setProcessingMessage('결제를 처리하고 있습니다...');
    setError(null);

    try {
      const { error: billingError } = await issueBillingKey(planKey, authKey, orgId);

      if (billingError) {
        setError(getUserMessage(billingError));
        setIsProcessing(false);

        // URL 파라미터 정리 (재시도 가능하도록)
        callbackProcessed.current = false;
        cleanUrlParams();
        return;
      }

      // 구독 상태 새로고침
      await refreshSubscription();
      setIsProcessing(false);
      setSuccess(true);

      // URL 파라미터 정리
      cleanUrlParams();
    } catch (err) {
      if (__DEV__) console.warn('[AppError] processPaymentCallback:', err);
      setError(getUserMessage(err));
      setIsProcessing(false);
      callbackProcessed.current = false;
      cleanUrlParams();
    }
  };

  // 웹: URL 파라미터 정리 (리로드 시 재처리 방지)
  const cleanUrlParams = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('authKey');
      url.searchParams.delete('customerKey');
      url.searchParams.delete('planKey');
      url.searchParams.delete('paymentStatus');
      url.searchParams.delete('code');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.pathname);
    }
  };

  // 결제 시작
  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (!user || !currentOrg) {
      Alert.alert('오류', '로그인 정보를 확인해 주세요.');
      return;
    }

    if (!isOwner) {
      Alert.alert('권한 없음', '구독 변경은 학원 원장만 가능합니다.');
      return;
    }

    if (plan.plan_key === 'free' || plan.plan_key === currentPlanKey) return;

    if (plan.plan_key === 'academy') {
      Alert.alert('도입 문의', 'Academy 플랜은 별도 문의가 필요합니다.\nspeaky@support.com');
      return;
    }

    // 다운그레이드 차단
    const currentIdx = PLAN_ORDER.indexOf(currentPlanKey || 'free');
    const targetIdx = PLAN_ORDER.indexOf(plan.plan_key);
    if (targetIdx <= currentIdx) {
      Alert.alert('안내', '현재 플랜보다 낮은 플랜으로는 변경할 수 없습니다.');
      return;
    }

    setError(null);

    if (Platform.OS === 'web') {
      if (!isTossConfigured()) {
        Alert.alert('설정 필요', '결제 시스템이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.');
        return;
      }

      try {
        const urls = buildPaymentUrls(plan.plan_key);
        if (!urls) {
          Alert.alert('오류', '결제 URL을 생성할 수 없습니다.');
          return;
        }

        await requestTossBillingAuth({
          customerKey: user.id,
          successUrl: urls.successUrl,
          failUrl: urls.failUrl,
        });
        // 리다이렉트됨 — 이후 코드 실행 안 됨
      } catch (err) {
        if (__DEV__) console.warn('[AppError] Toss billing auth:', err);
        Alert.alert('결제 오류', getUserMessage(err));
      }
    } else {
      // 네이티브: 웹 브라우저에서 결제 진행
      const webUrl = process.env.EXPO_PUBLIC_WEB_URL;
      if (webUrl) {
        try {
          await WebBrowser.openBrowserAsync(
            `${webUrl}/(teacher)/settings/plan-select`
          );
          // 브라우저 닫힌 후 구독 새로고침
          await refreshSubscription();
        } catch (err) {
          if (__DEV__) console.warn('[AppError] WebBrowser:', err);
          Alert.alert('오류', getUserMessage(err));
        }
      } else {
        Alert.alert(
          '웹에서 결제',
          '결제는 웹 브라우저에서 진행해 주세요.\n결제 완료 후 앱에 자동 반영됩니다.'
        );
      }
    }
  };

  // ── 로딩 ──
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── 결제 처리 중 ──
  if (isProcessing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.processingText, { color: colors.textSecondary }]}>
          {processingMessage}
        </Text>
      </View>
    );
  }

  // ── 결제 완료 ──
  if (success) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="checkmark-circle" size={64} color="#10B981" />
        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
          구독이 완료되었습니다
        </Text>
        <Text style={[styles.successSub, { color: colors.textSecondary }]}>
          새로운 플랜이 즉시 적용됩니다
        </Text>
        <Pressable
          style={[styles.successButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.successButtonText}>확인</Text>
        </Pressable>
      </View>
    );
  }

  const sortedPlans = [...plans].sort(
    (a, b) => PLAN_ORDER.indexOf(a.plan_key) - PLAN_ORDER.indexOf(b.plan_key)
  );

  const currentIdx = PLAN_ORDER.indexOf(currentPlanKey || 'free');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      contentContainerStyle={styles.content}
    >
      {error && (
        <View style={[styles.errorCard, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        학원에 맞는 플랜을 선택하세요
      </Text>

      {sortedPlans.map((plan) => {
        const isCurrent = plan.plan_key === (currentPlanKey || 'free');
        const isHighlighted = plan.plan_key === 'pro';
        const targetIdx = PLAN_ORDER.indexOf(plan.plan_key);
        const isUpgradeable = targetIdx > currentIdx && plan.plan_key !== 'free';

        return (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              {
                backgroundColor: colors.surface,
                borderColor: isCurrent ? colors.primary : isHighlighted ? '#D4707F' : colors.border,
              },
              (isCurrent || isHighlighted) && { borderWidth: 2 },
            ]}
          >
            {/* 배지 */}
            <View style={styles.badgeRow}>
              {isCurrent && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>현재 플랜</Text>
                </View>
              )}
              {isHighlighted && !isCurrent && (
                <View style={[styles.badge, { backgroundColor: '#D4707F' }]}>
                  <Text style={styles.badgeText}>추천</Text>
                </View>
              )}
            </View>

            {/* 플랜 정보 */}
            <Text style={[styles.planName, { color: colors.textPrimary }]}>
              {plan.name}
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.textPrimary }]}>
                {plan.plan_key === 'academy'
                  ? '문의'
                  : plan.price_monthly === 0
                    ? '₩0'
                    : `₩${plan.price_monthly.toLocaleString('ko-KR')}`}
              </Text>
              {plan.price_monthly > 0 && (
                <Text style={[styles.period, { color: colors.textDisabled }]}>/월</Text>
              )}
            </View>

            {/* 기능 목록 */}
            <View style={styles.featureList}>
              <FeatureItem
                label={`학생 ${plan.max_students >= 999999 ? '무제한' : plan.max_students + '명'}`}
                enabled
                colors={colors}
              />
              <FeatureItem
                label={`스크립트 ${plan.max_scripts >= 999999 ? '무제한' : plan.max_scripts + '개'}`}
                enabled
                colors={colors}
              />
              <FeatureItem label="AI 피드백" enabled={plan.ai_feedback_enabled} colors={colors} />
              <FeatureItem label="TTS 음성" enabled={plan.tts_enabled} colors={colors} />
            </View>

            {/* CTA 버튼 */}
            {isOwner && !isCurrent && (
              <Pressable
                style={[
                  styles.ctaButton,
                  isUpgradeable
                    ? { backgroundColor: isHighlighted ? '#D4707F' : colors.primary }
                    : { backgroundColor: colors.surfaceSecondary },
                ]}
                onPress={() => isUpgradeable && handleSelectPlan(plan)}
                disabled={!isUpgradeable}
              >
                <Text style={[
                  styles.ctaText,
                  isUpgradeable ? { color: '#fff' } : { color: colors.textDisabled },
                ]}>
                  {plan.plan_key === 'academy'
                    ? '도입 문의'
                    : isUpgradeable
                      ? '결제하기'
                      : '현재 플랜 이하'}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}

      {!isOwner && (
        <Text style={[styles.note, { color: colors.textDisabled }]}>
          플랜 변경은 학원 원장만 가능합니다
        </Text>
      )}
    </ScrollView>
  );
}

function FeatureItem({ label, enabled, colors }: { label: string; enabled: boolean; colors: any }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons
        name={enabled ? 'checkmark-circle' : 'close-circle-outline'}
        size={16}
        color={enabled ? '#10B981' : colors.textDisabled}
      />
      <Text style={[
        styles.featureText,
        { color: enabled ? colors.textPrimary : colors.textDisabled },
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },

  subtitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    marginBottom: 4,
  },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: '#EF4444',
    flex: 1,
  },

  planCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    minHeight: 22,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Pretendard-Bold',
    color: '#fff',
  },

  planName: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 16,
  },
  price: {
    fontSize: 28,
    fontFamily: 'Pretendard-Bold',
  },
  period: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },

  featureList: {
    gap: 8,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },

  ctaButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },

  note: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    marginTop: 8,
  },

  processingText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
    marginTop: 16,
  },

  successTitle: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    marginTop: 16,
  },
  successSub: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginTop: 6,
  },
  successButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  successButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#fff',
  },
});
