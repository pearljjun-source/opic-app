import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { getRemainingQuota, getPaymentHistory, cancelSubscription } from '@/services/billing';
import { getUserMessage } from '@/lib/errors';
import type { PaymentRecord } from '@/lib/types';

export default function SubscriptionScreen() {
  const colors = useThemeColors();
  const { orgRole, currentOrg } = useAuth();
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
              Alert.alert('완료', '구독 취소가 예약되었습니다.');
              refresh();
            }
          },
        },
      ]
    );
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
              { backgroundColor: isActive ? '#10B98120' : '#EF444420' },
            ]}>
              <Text style={[
                styles.statusText,
                { color: isActive ? '#10B981' : '#EF4444' },
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
          <Text style={[styles.cancelNote, { color: '#F59E0B' }]}>
            기간 만료 시 구독이 종료됩니다
          </Text>
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
            color={plan?.ai_feedback_enabled ? '#10B981' : colors.textDisabled}
          />
        </View>
        <View style={styles.featureRow}>
          <Text style={[styles.featureLabel, { color: colors.textSecondary }]}>TTS 음성</Text>
          <Ionicons
            name={plan?.tts_enabled ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={plan?.tts_enabled ? '#10B981' : colors.textDisabled}
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
            <View key={payment.id} style={styles.paymentRow}>
              <View>
                <Text style={[styles.paymentDate, { color: colors.textSecondary }]}>
                  {payment.paid_at ? formatDate(payment.paid_at) : formatDate(payment.created_at)}
                </Text>
              </View>
              <View style={styles.paymentRight}>
                <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>
                  {formatAmount(payment.amount)}
                </Text>
                <Text style={[
                  styles.paymentStatus,
                  { color: payment.status === 'paid' ? '#10B981' : '#EF4444' },
                ]}>
                  {payment.status === 'paid' ? '완료' :
                   payment.status === 'failed' ? '실패' :
                   payment.status === 'refunded' ? '환불' : payment.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 구독 취소 버튼 */}
      {isOwner && isActive && !subscription?.cancel_at_period_end && planKey !== 'free' && (
        <Pressable
          style={[styles.cancelButton, { borderColor: '#EF4444' }]}
          onPress={handleCancel}
        >
          <Text style={styles.cancelButtonText}>구독 취소</Text>
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
  cancelButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#EF4444',
  },
  note: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
  },
});
