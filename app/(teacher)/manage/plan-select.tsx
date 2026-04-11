import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors, type ThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { getSubscriptionPlans, changePlan } from '@/services/billing';
import { getUserMessage } from '@/lib/errors';
import { requestTossBillingAuth, isTossConfigured, buildPaymentUrls } from '@/lib/toss';
import { PAYMENT_CALLBACK, CONTACT, ALL_PLAN_KEYS } from '@/lib/constants';
import { alert as xAlert, confirm as xConfirm } from '@/lib/alert';
import type { SubscriptionPlan } from '@/lib/types';

const PLAN_ORDER = ALL_PLAN_KEYS;

export default function PlanSelectScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  const { user, currentOrg, orgRole } = useAuth();
  const { subscription, planKey: currentPlanKey, refresh: refreshSubscription } = useSubscription();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const isOwner = orgRole === 'owner';

  // 플랜 목록 로드
  useEffect(() => {
    getSubscriptionPlans().then(({ data }) => {
      if (data) setPlans(data);
      setIsLoading(false);
    });
  }, []);

  // 결제 시작
  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (__DEV__) console.warn('[PlanSelect] handleSelectPlan:', {
      planKey: plan.plan_key, user: !!user, currentOrg: !!currentOrg,
      isOwner, currentPlanKey, hasSubscription: !!subscription,
      subscriptionStatus: subscription?.status,
    });

    if (!user || !currentOrg) {
      xAlert('오류', '로그인 정보를 확인해 주세요.');
      return;
    }

    if (!isOwner) {
      xAlert('권한 없음', '구독 변경은 학원 원장만 가능합니다.');
      return;
    }

    if (plan.plan_key === currentPlanKey) return;

    if (plan.plan_key === 'academy') {
      xAlert('도입 문의', `Academy 플랜은 별도 문의가 필요합니다.\n${CONTACT.SUPPORT_EMAIL}`);
      return;
    }

    setError(null);

    // 기존 유료 구독이 있으면 change-plan Edge Function 사용
    const hasActiveSub = subscription && subscription.status === 'active';
    if (hasActiveSub && currentPlanKey && currentPlanKey !== 'free') {
      const currentIdx = PLAN_ORDER.indexOf(currentPlanKey);
      const targetIdx = PLAN_ORDER.indexOf(plan.plan_key);
      const isDowngrade = targetIdx < currentIdx;

      if (isDowngrade) {
        xConfirm(
          '플랜 다운그레이드',
          `${plan.name} 플랜으로 변경하시겠습니까?\n다음 갱신일부터 적용됩니다.`,
          async () => {
            setIsProcessing(true);
            setProcessingMessage('플랜을 변경하고 있습니다...');
            const { error: changeError } = await changePlan(plan.plan_key, currentOrg!.id);
            setIsProcessing(false);
            if (changeError) {
              setError(getUserMessage(changeError));
            } else {
              await refreshSubscription();
              xAlert('완료', '플랜이 변경되었습니다.');
            }
          },
          { confirmText: '변경' },
        );
      } else {
        // 업그레이드: 일할 결제
        xConfirm(
          '플랜 업그레이드',
          `${plan.name} 플랜으로 업그레이드하시겠습니까?\n남은 기간에 대한 차액이 즉시 결제됩니다.`,
          async () => {
            setIsProcessing(true);
            setProcessingMessage('업그레이드를 처리하고 있습니다...');
            const { error: changeError } = await changePlan(plan.plan_key, currentOrg!.id);
            setIsProcessing(false);
            if (changeError) {
              setError(getUserMessage(changeError));
            } else {
              await refreshSubscription();
              xAlert('완료', '업그레이드가 완료되었습니다.');
            }
          },
          { confirmText: '업그레이드' },
        );
      }
      return;
    }

    // 새 구독 (free → 유료): Toss 빌링키 발급 플로우
    if (plan.plan_key === 'free') return;

    if (Platform.OS === 'web') {
      if (!isTossConfigured()) {
        xAlert('설정 필요', '결제 시스템이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.');
        return;
      }

      try {
        const urls = buildPaymentUrls({
          action: 'new-subscription',
          planKey: plan.plan_key,
          cycle: billingCycle,
        });
        if (!urls) {
          xAlert('오류', '결제 URL을 생성할 수 없습니다.');
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
        xAlert('결제 오류', getUserMessage(err));
      }
    } else {
      // 네이티브: 웹 브라우저에서 결제 진행
      const webUrl = process.env.EXPO_PUBLIC_WEB_URL;
      if (webUrl) {
        try {
          await WebBrowser.openBrowserAsync(
            `${webUrl}/(teacher)/manage/plan-select`
          );
          // 브라우저 닫힌 후 구독 새로고침
          await refreshSubscription();
        } catch (err) {
          if (__DEV__) console.warn('[AppError] WebBrowser:', err);
          xAlert('오류', getUserMessage(err));
        }
      } else {
        xAlert(
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

  // ── 결제 처리 중 (change-plan) ──
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
        <View style={[styles.errorCard, { backgroundColor: colors.accentRedBg, borderColor: colors.error }]}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        학원에 맞는 플랜을 선택하세요
      </Text>

      {/* 월간/연간 토글 */}
      <View style={[styles.cycleToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          style={[
            styles.cycleOption,
            billingCycle === 'monthly' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setBillingCycle('monthly')}
        >
          <Text style={[
            styles.cycleText,
            { color: billingCycle === 'monthly' ? '#fff' : colors.textSecondary },
          ]}>
            월간
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.cycleOption,
            billingCycle === 'yearly' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setBillingCycle('yearly')}
        >
          <Text style={[
            styles.cycleText,
            { color: billingCycle === 'yearly' ? '#fff' : colors.textSecondary },
          ]}>
            연간
          </Text>
          <View style={[styles.discountBadge, { backgroundColor: colors.accentGreenBg }]}>
            <Text style={[styles.discountText, { color: colors.accentGreenText }]}>할인</Text>
          </View>
        </Pressable>
      </View>

      {sortedPlans.map((plan) => {
        const isCurrent = plan.plan_key === (currentPlanKey || 'free');
        const isHighlighted = plan.plan_key === 'pro';
        const targetIdx = PLAN_ORDER.indexOf(plan.plan_key);
        const isUpgradeable = targetIdx > currentIdx && plan.plan_key !== 'free';
        const isDowngradeable = targetIdx < currentIdx && plan.plan_key !== 'free';
        const isChangeable = isUpgradeable || isDowngradeable;

        return (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              {
                backgroundColor: colors.surface,
                borderColor: isCurrent ? colors.primary : isHighlighted ? colors.primary : colors.border,
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
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>추천</Text>
                </View>
              )}
            </View>

            {/* 플랜 정보 */}
            <Text style={[styles.planName, { color: colors.textPrimary }]}>
              {plan.name}
            </Text>
            <View style={styles.priceRow}>
              {billingCycle === 'monthly' || plan.price_monthly === 0 ? (
                <>
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
                </>
              ) : (
                <>
                  <Text style={[styles.price, { color: colors.textPrimary }]}>
                    {plan.plan_key === 'academy'
                      ? '문의'
                      : `₩${plan.price_yearly.toLocaleString('ko-KR')}`}
                  </Text>
                  <Text style={[styles.period, { color: colors.textDisabled }]}>/년</Text>
                </>
              )}
            </View>
            {billingCycle === 'yearly' && plan.price_monthly > 0 && plan.plan_key !== 'academy' && (
              <View style={styles.savingsRow}>
                <Text style={[styles.savingsText, { color: colors.success }]}>
                  월 ₩{Math.round(plan.price_yearly / 12).toLocaleString('ko-KR')} · {Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100)}% 절약
                </Text>
              </View>
            )}

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
              <FeatureItem label="한→영 번역" enabled={plan.translation_enabled} colors={colors} />
            </View>

            {/* CTA 버튼 */}
            {isOwner && !isCurrent && (
              <Pressable
                style={[
                  styles.ctaButton,
                  isUpgradeable
                    ? { backgroundColor: colors.primary }
                    : isDowngradeable
                      ? { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }
                      : { backgroundColor: colors.surfaceSecondary },
                ]}
                onPress={() => isChangeable && handleSelectPlan(plan)}
                disabled={!isChangeable && plan.plan_key !== 'academy'}
              >
                <Text style={[
                  styles.ctaText,
                  isUpgradeable ? { color: '#fff' }
                    : isDowngradeable ? { color: colors.textPrimary }
                    : { color: colors.textDisabled },
                ]}>
                  {plan.plan_key === 'academy'
                    ? '도입 문의'
                    : isUpgradeable
                      ? '업그레이드'
                      : isDowngradeable
                        ? '다운그레이드'
                        : '선택 불가'}
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

function FeatureItem({ label, enabled, colors }: { label: string; enabled: boolean; colors: ThemeColors }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons
        name={enabled ? 'checkmark-circle' : 'close-circle-outline'}
        size={16}
        color={enabled ? colors.success : colors.textDisabled}
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

  cycleToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 4,
  },
  cycleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cycleText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  discountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 10,
    fontFamily: 'Pretendard-Bold',
  },
  savingsRow: {
    marginTop: -8,
    marginBottom: 8,
  },
  savingsText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
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
});
