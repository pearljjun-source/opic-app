import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import { adminGetSubscriptionStats, adminGetPaymentHistory, getSubscriptionPlans } from '@/services/billing';
import type { SubscriptionStats, SubscriptionPlan, PaymentRecord } from '@/lib/types';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  paid: { text: '완료', color: COLORS.SUCCESS },
  pending: { text: '대기', color: COLORS.WARNING },
  failed: { text: '실패', color: COLORS.ERROR },
  refunded: { text: '환불', color: COLORS.GRAY_500 },
  canceled: { text: '취소', color: COLORS.GRAY_400 },
};

export default function AdminBillingScreen() {
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);

    const [statsResult, plansResult, paymentsResult] = await Promise.all([
      adminGetSubscriptionStats(),
      getSubscriptionPlans(),
      adminGetPaymentHistory({ limit: 20 }),
    ]);

    if (statsResult.error) {
      setError(getUserMessage(statsResult.error));
    } else {
      setStats(statsResult.data);
    }

    if (plansResult.data) setPlans(plansResult.data);
    if (paymentsResult.data) setPayments(paymentsResult.data);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  const formatCurrency = (amount: number) =>
    `\u20A9${amount.toLocaleString()}`;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.PRIMARY} />
      }
    >
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* 구독 통계 */}
      <Text style={styles.sectionTitle}>구독 통계</Text>
      <View style={styles.statRow}>
        <StatCard label="MRR" value={formatCurrency(stats?.mrr ?? 0)} />
        <StatCard label="구독자" value={stats?.total_subscribers ?? 0} />
      </View>
      <View style={styles.statRow}>
        <StatCard label="ARR" value={formatCurrency(stats?.arr ?? 0)} />
        <StatCard label="이탈률" value={`${((stats?.churn_rate ?? 0) * 100).toFixed(1)}%`} />
      </View>

      {/* 플랜 관리 */}
      <Text style={styles.sectionTitle}>플랜 관리</Text>
      {plans.map((plan) => (
        <View key={plan.id} style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>{formatCurrency(plan.price_monthly)}/월</Text>
          </View>
          <View style={styles.planDetails}>
            <Text style={styles.planDetail}>학생 {plan.max_students}명</Text>
            <Text style={styles.planDetail}>스크립트 {plan.max_scripts >= 9999 ? '무제한' : `${plan.max_scripts}개`}</Text>
            {plan.ai_feedback_enabled && <Text style={styles.planDetail}>AI 피드백</Text>}
            {plan.tts_enabled && <Text style={styles.planDetail}>TTS</Text>}
          </View>
        </View>
      ))}

      {/* 최근 결제 */}
      <Text style={styles.sectionTitle}>최근 결제</Text>
      {payments.map((payment) => {
        const status = STATUS_LABELS[payment.status] || { text: payment.status, color: COLORS.GRAY_400 };
        return (
          <View key={payment.id} style={styles.paymentCard}>
            <View style={styles.paymentMain}>
              <View>
                <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                <Text style={styles.paymentDate}>
                  {new Date(payment.created_at).toLocaleDateString('ko-KR')}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                <Text style={styles.statusText}>{status.text}</Text>
              </View>
            </View>
            {payment.card_last4 && (
              <Text style={styles.paymentMeta}>**** {payment.card_last4}</Text>
            )}
            {payment.failure_reason && (
              <Text style={styles.failureText}>{payment.failure_reason}</Text>
            )}
          </View>
        );
      })}
      {payments.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>결제 내역이 없습니다</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BACKGROUND_SECONDARY },
  errorText: { color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium', marginBottom: 12 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 20,
    marginBottom: 12,
  },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  statLabel: { fontSize: 12, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY, marginBottom: 4 },
  statValue: { fontSize: 20, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  planCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  planName: { fontSize: 15, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  planPrice: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', color: COLORS.PRIMARY },
  planDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planDetail: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
    backgroundColor: COLORS.GRAY_100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  paymentMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentAmount: { fontSize: 15, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  paymentDate: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontFamily: 'Pretendard-Bold', color: COLORS.WHITE },
  paymentMeta: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400, marginTop: 6 },
  failureText: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.ERROR, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },
});
