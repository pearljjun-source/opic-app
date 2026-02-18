import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';
import { getUserMessage } from '@/lib/errors';
import { adminGetPaymentHistory } from '@/services/billing';
import { supabase } from '@/lib/supabase';
import type { PaymentRecord } from '@/lib/types';

export default function AdminSubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const STATUS_LABELS: Record<string, { text: string; color: string }> = {
    active: { text: '활성', color: colors.success },
    past_due: { text: '연체', color: colors.warning },
    canceled: { text: '취소', color: colors.error },
    trialing: { text: '체험', color: colors.info },
    incomplete: { text: '미완료', color: colors.gray400 },
  };

  const PAY_STATUS: Record<string, { text: string; color: string }> = {
    paid: { text: '완료', color: colors.success },
    pending: { text: '대기', color: colors.warning },
    failed: { text: '실패', color: colors.error },
    refunded: { text: '환불', color: colors.gray500 },
    canceled: { text: '취소', color: colors.gray400 },
  };

  const [subscription, setSubscription] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;

    // 구독 정보 + 플랜 + 사용자
    const { data: subData, error: subError } = await supabase
      .from('subscriptions')
      .select('*, subscription_plans(*), users(name, email)')
      .eq('id', id)
      .single();

    if (subError) {
      setError(getUserMessage(subError));
    } else {
      setSubscription(subData);

      // 해당 구독의 결제 이력
      const { data: payData } = await adminGetPaymentHistory({
        userId: subData.user_id,
        limit: 20,
      });
      if (payData) setPayments(payData);
    }

    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount: number) =>
    `\u20A9${amount.toLocaleString()}`;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !subscription) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error || '구독 정보를 찾을 수 없습니다'}</Text>
      </View>
    );
  }

  const status = STATUS_LABELS[subscription.status] || { text: subscription.status, color: colors.gray400 };
  const plan = subscription.subscription_plans;
  const user = subscription.users;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>구독 상세</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 구독 정보 */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>구독 정보</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
              <Text style={styles.statusText}>{status.text}</Text>
            </View>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.gray100 }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>사용자</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user?.name} ({user?.email})</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.gray100 }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>플랜</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{plan?.name}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.gray100 }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>결제 수단</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{subscription.billing_provider}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.gray100 }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>현재 기간</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
              {new Date(subscription.current_period_start).toLocaleDateString('ko-KR')}
              {' ~ '}
              {new Date(subscription.current_period_end).toLocaleDateString('ko-KR')}
            </Text>
          </View>
          {subscription.cancel_at_period_end && (
            <View style={[styles.cancelNotice, { backgroundColor: colors.warning + '20' }]}>
              <Text style={[styles.cancelText, { color: colors.warning }]}>기간 만료 시 자동 해지 예정</Text>
            </View>
          )}
        </View>

        {/* 결제 이력 */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>결제 이력</Text>
        {payments.map((payment) => {
          const payStatus = PAY_STATUS[payment.status] || { text: payment.status, color: colors.gray400 };
          return (
            <View key={payment.id} style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>{formatCurrency(payment.amount)}</Text>
                <View style={[styles.payStatusBadge, { backgroundColor: payStatus.color }]}>
                  <Text style={styles.payStatusText}>{payStatus.text}</Text>
                </View>
              </View>
              <Text style={[styles.paymentDate, { color: colors.gray400 }]}>
                {new Date(payment.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
              {payment.card_last4 && (
                <Text style={[styles.paymentMeta, { color: colors.gray400 }]}>카드 **** {payment.card_last4}</Text>
              )}
              {payment.failure_reason && (
                <Text style={[styles.failureText, { color: colors.error }]}>{payment.failure_reason}</Text>
              )}
            </View>
          );
        })}
        {payments.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>결제 내역이 없습니다</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Pretendard-Bold' },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontFamily: 'Pretendard-Bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontFamily: 'Pretendard-Bold', color: '#FFFFFF' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontFamily: 'Pretendard-Medium' },
  infoValue: { fontSize: 13, fontFamily: 'Pretendard-Medium', textAlign: 'right', flex: 1, marginLeft: 12 },
  cancelNotice: { borderRadius: 8, padding: 10, marginTop: 12 },
  cancelText: { fontSize: 12, fontFamily: 'Pretendard-Medium', textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontFamily: 'Pretendard-Bold', marginBottom: 12 },
  paymentCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  paymentAmount: { fontSize: 15, fontFamily: 'Pretendard-Bold' },
  payStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  payStatusText: { fontSize: 10, fontFamily: 'Pretendard-Bold', color: '#FFFFFF' },
  paymentDate: { fontSize: 11, fontFamily: 'Pretendard-Regular' },
  paymentMeta: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 4 },
  failureText: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
});
