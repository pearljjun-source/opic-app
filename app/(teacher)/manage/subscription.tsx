import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Platform, Linking } from 'react-native';
import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { getRemainingQuota, getPaymentHistory, cancelSubscription, updateBillingKey } from '@/services/billing';
import { getUserMessage } from '@/lib/errors';
import { requestTossBillingAuth, isTossConfigured, buildPaymentUrls } from '@/lib/toss';
import type { PaymentRecord } from '@/lib/types';
import { showToast } from '@/lib/toast';

export default function SubscriptionScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { user, orgRole, currentOrg } = useAuth();
  const { subscription, plan, planKey, isActive, isLoading: subLoading, refresh } = useSubscription();

  const [studentQuota, setStudentQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [scriptQuota, setScriptQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isOwner = orgRole === 'owner';

  const loadQuotas = useCallback(async () => {
    const [students, scripts] = await Promise.all([
      getRemainingQuota('students'),
      getRemainingQuota('scripts'),
    ]);
    setStudentQuota(students);
    setScriptQuota(scripts);
  }, []);

  const loadPayments = useCallback(async () => {
    const { data } = await getPaymentHistory({ limit: 5 });
    if (data) setPayments(data);
  }, []);

  useEffect(() => {
    loadQuotas();
    loadPayments();
  }, [loadQuotas, loadPayments]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refresh(), loadQuotas(), loadPayments()]);
    setIsRefreshing(false);
  }, [refresh, loadQuotas, loadPayments]);

  const handleCancel = () => {
    if (!subscription) return;
    Alert.alert(
      '구독 취소',
      '현재 결제 기간이 끝나면 구독이 종료됩니다. 취소하시겠습니까?',
      [
        { text: '아니오', style: 'cancel' },
        {
          text: '취소하기',
          style: 'destructive',
          onPress: async () => {
            const { error } = await cancelSubscription(subscription.id);
            if (error) {
              Alert.alert('오류', getUserMessage(error));
            } else {
              showToast('구독 취소가 예약되었습니다.');
              refresh();
            }
          },
        },
      ]
    );
  };

  // 결제 수단 변경 콜백 처리 (웹: Toss 리다이렉트 후)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const authKey = url.searchParams.get('authKey');
    const action = url.searchParams.get('action');
    if (authKey && action === 'update-billing' && currentOrg?.id) {
      // URL 파라미터 정리
      url.searchParams.delete('authKey');
      url.searchParams.delete('customerKey');
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.pathname);

      (async () => {
        const { error } = await updateBillingKey(authKey, currentOrg.id);
        if (error) {
          Alert.alert('오류', getUserMessage(error));
        } else {
          showToast('결제 수단이 변경되었습니다.');
          refresh();
        }
      })();
    }
  }, [currentOrg]);

  const handleUpdateBillingKey = async () => {
    if (!user || !currentOrg) return;

    if (Platform.OS === 'web') {
      if (!isTossConfigured()) {
        Alert.alert('설정 필요', '결제 시스템이 아직 설정되지 않았습니다.');
        return;
      }
      try {
        const base = window.location.origin;
        const path = '/(teacher)/manage/subscription';
        await requestTossBillingAuth({
          customerKey: user.id,
          successUrl: `${base}${path}?action=update-billing`,
          failUrl: `${base}${path}`,
        });
      } catch (err) {
        Alert.alert('오류', getUserMessage(err));
      }
    } else {
      Alert.alert('웹에서 변경', '결제 수단 변경은 웹 브라우저에서 진행해 주세요.');
    }
  };

  const handleOpenReceipt = (receiptUrl: string) => {
    if (Platform.OS === 'web') {
      window.open(receiptUrl, '_blank');
    } else {
      Linking.openURL(receiptUrl);
    }
  };

  if (subLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {/* 현재 플랜 */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="diamond-outline" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>현재 플랜</Text>
        </View>

        <Text style={[styles.planName, { color: colors.primary }]}>
          {plan?.name || 'Free'}
        </Text>

        {plan && (
          <Text style={[styles.planPrice, { color: colors.textSecondary }]}>
            {plan.price_monthly > 0
              ? `월 ${formatAmount(plan.price_monthly)}`
              : '무료'}
          </Text>
        )}

        {subscription && (
          <View style={styles.statusRow}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: isActive ? colors.accentGreenBg : colors.accentRedBg },
            ]}>
              <Text style={[
                styles.statusText,
                { color: isActive ? colors.accentGreenText : colors.accentRedText },
              ]}>
                {subscription.status === 'active' ? '활성' :
                 subscription.status === 'trialing' ? '체험' :
                 subscription.status === 'past_due' ? '결제 지연' :
                 subscription.status === 'canceled' ? '취소됨' : subscription.status}
              </Text>
            </View>
            {subscription.current_period_end && (
              <Text style={[styles.periodText, { color: colors.textDisabled }]}>
                {formatDate(subscription.current_period_end)}까지
              </Text>
            )}
          </View>
        )}

        {subscription?.cancel_at_period_end && (
          <Text style={[styles.cancelNote, { color: colors.warning }]}>
            기간 만료 시 구독이 종료됩니다
          </Text>
        )}

        {subscription?.status === 'past_due' && (
          <View style={[styles.graceWarning, { backgroundColor: colors.accentRedBg }]}>
            <Ionicons name="warning" size={16} color={colors.error} />
            <Text style={[styles.graceWarningText, { color: colors.error }]}>
              결제에 실패했습니다. 7일 이내에 결제 수단을 변경해 주세요.
            </Text>
          </View>
        )}

        {(subscription as any)?.pending_plan_id && (
          <Text style={[styles.cancelNote, { color: colors.primary }]}>
            다음 갱신 시 플랜이 변경됩니다
          </Text>
        )}

        {isOwner && (
          <View style={styles.ownerActions}>
            <Pressable
              style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(teacher)/manage/plan-select')}
            >
              <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
              <Text style={styles.upgradeButtonText}>플랜 변경</Text>
            </Pressable>
            {subscription && planKey !== 'free' && (
              <Pressable
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={handleUpdateBillingKey}
              >
                <Ionicons name="card-outline" size={18} color={colors.textPrimary} />
                <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>결제 수단 변경</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* 기능 현황 */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>기능</Text>
        </View>

        <View style={styles.featureRow}>
          <Text style={[styles.featureLabel, { color: colors.textSecondary }]}>AI 피드백</Text>
          <Ionicons
            name={plan?.ai_feedback_enabled ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={plan?.ai_feedback_enabled ? colors.success : colors.textDisabled}
          />
        </View>
        <View style={styles.featureRow}>
          <Text style={[styles.featureLabel, { color: colors.textSecondary }]}>TTS 음성</Text>
          <Ionicons
            name={plan?.tts_enabled ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={plan?.tts_enabled ? colors.success : colors.textDisabled}
          />
        </View>
      </View>

      {/* 사용량 */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="bar-chart-outline" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>사용량</Text>
        </View>

        {studentQuota && (
          <View style={styles.quotaRow}>
            <Text style={[styles.quotaLabel, { color: colors.textSecondary }]}>학생</Text>
            <Text style={[styles.quotaValue, { color: colors.textPrimary }]}>
              {studentQuota.used} / {studentQuota.limit >= 999999 ? '무제한' : studentQuota.limit}
            </Text>
          </View>
        )}

        {scriptQuota && (
          <View style={styles.quotaRow}>
            <Text style={[styles.quotaLabel, { color: colors.textSecondary }]}>스크립트</Text>
            <Text style={[styles.quotaValue, { color: colors.textPrimary }]}>
              {scriptQuota.used} / {scriptQuota.limit >= 999999 ? '무제한' : scriptQuota.limit}
            </Text>
          </View>
        )}
      </View>

      {/* 결제 이력 */}
      {payments.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt-outline" size={22} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>최근 결제</Text>
          </View>

          {payments.map((payment) => (
            <Pressable
              key={payment.id}
              style={styles.paymentRow}
              onPress={() => payment.receipt_url ? handleOpenReceipt(payment.receipt_url) : undefined}
              disabled={!payment.receipt_url}
            >
              <View>
                <Text style={[styles.paymentDate, { color: colors.textSecondary }]}>
                  {payment.paid_at ? formatDate(payment.paid_at) : formatDate(payment.created_at)}
                </Text>
                {payment.receipt_url && (
                  <Text style={[styles.receiptLink, { color: colors.primary }]}>영수증</Text>
                )}
              </View>
              <View style={styles.paymentRight}>
                <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>
                  {formatAmount(payment.amount)}
                </Text>
                <Text style={[
                  styles.paymentStatus,
                  { color: payment.status === 'paid' ? colors.success : colors.error },
                ]}>
                  {payment.status === 'paid' ? '완료' :
                   payment.status === 'failed' ? '실패' :
                   payment.status === 'refunded' ? '환불' : payment.status}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* 구독 취소 버튼 */}
      {isOwner && isActive && !subscription?.cancel_at_period_end && planKey !== 'free' && (
        <Pressable
          style={[styles.cancelButton, { borderColor: colors.error }]}
          onPress={handleCancel}
        >
          <Text style={[styles.cancelButtonText, { color: colors.error }]}>구독 취소</Text>
        </Pressable>
      )}

      {/* 안내 */}
      {!isOwner && (
        <Text style={[styles.note, { color: colors.textDisabled }]}>
          구독 관리는 학원 원장만 가능합니다
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  planName: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
  },
  periodText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
  },
  cancelNote: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  featureLabel: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  quotaLabel: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },
  quotaValue: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  paymentDate: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  paymentStatus: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
  },
  ownerActions: {
    gap: 8,
    marginTop: 12,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  graceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  graceWarningText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    flex: 1,
  },
  receiptLink: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
    marginTop: 2,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  note: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
  },
});
