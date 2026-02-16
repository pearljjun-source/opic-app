import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import { listOrganizations, getOrganizationDetail, getOrganizationPayments } from '@/services/admin';
import type { AdminOrganizationItem, AdminOrgMemberItem, AdminOrgSubscription, PaymentRecord } from '@/lib/types';

// ============================================================================
// Status / Role Badges
// ============================================================================

const SUB_STATUS: Record<string, { text: string; bg: string; color: string }> = {
  active: { text: '활성', bg: '#D1FAE5', color: '#059669' },
  trialing: { text: '체험', bg: '#DBEAFE', color: COLORS.PRIMARY },
  past_due: { text: '연체', bg: '#FEF3C7', color: '#D97706' },
};

const ROLE_STYLE: Record<string, { text: string; bg: string; color: string }> = {
  owner: { text: '원장', bg: '#EDE9FE', color: '#7C3AED' },
  teacher: { text: '강사', bg: '#DBEAFE', color: COLORS.PRIMARY },
  student: { text: '학생', bg: '#D1FAE5', color: '#059669' },
};

const PAY_STATUS: Record<string, { text: string; color: string }> = {
  paid: { text: '완료', color: COLORS.SUCCESS },
  pending: { text: '대기', color: COLORS.WARNING },
  failed: { text: '실패', color: COLORS.ERROR },
  refunded: { text: '환불', color: COLORS.GRAY_500 },
  canceled: { text: '취소', color: COLORS.GRAY_400 },
};

// ============================================================================
// Main
// ============================================================================

export default function AcademyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [org, setOrg] = useState<AdminOrganizationItem | null>(null);
  const [members, setMembers] = useState<AdminOrgMemberItem[]>([]);
  const [subscription, setSubscription] = useState<AdminOrgSubscription | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setError(null);

    const [orgsResult, detailResult, paymentsResult] = await Promise.all([
      listOrganizations(),
      getOrganizationDetail(id),
      getOrganizationPayments(id),
    ]);

    if (orgsResult.error) {
      setError(getUserMessage(orgsResult.error));
    } else {
      const found = orgsResult.data?.find(o => o.id === id) || null;
      setOrg(found);
    }

    if (detailResult.data) {
      setMembers(detailResult.data.members);
      setSubscription(detailResult.data.subscription);
    } else if (detailResult.error) {
      setError(getUserMessage(detailResult.error));
    }

    if (paymentsResult.data) {
      setPayments(paymentsResult.data);
    }

    setIsLoading(false);
  }, [id]);

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
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>학원 상세</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.PRIMARY} />
        }
      >
        {error && <Text style={styles.errorText}>{error}</Text>}

        {org && (
          <>
            {/* 학원 정보 */}
            <View style={styles.card}>
              <View style={styles.orgInfoRow}>
                <View style={styles.orgIconWrapper}>
                  <Ionicons name="business" size={24} color={COLORS.PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orgName}>{org.name}</Text>
                  <Text style={styles.orgMeta}>
                    원장: {org.owner_name} ({org.owner_email})
                  </Text>
                  <Text style={styles.orgMeta}>
                    개설: {new Date(org.created_at).toLocaleDateString('ko-KR')}
                  </Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{org.member_count}</Text>
                  <Text style={styles.statLabel}>전체</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{org.teacher_count}</Text>
                  <Text style={styles.statLabel}>강사</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{org.student_count}</Text>
                  <Text style={styles.statLabel}>학생</Text>
                </View>
              </View>
            </View>

            {/* 구독 정보 */}
            <Text style={styles.sectionTitle}>구독</Text>
            {subscription ? (
              <View style={styles.card}>
                <View style={styles.subRow}>
                  <Text style={styles.subPlan}>{subscription.plan_name}</Text>
                  <View style={[styles.badge, { backgroundColor: (SUB_STATUS[subscription.status] || SUB_STATUS.active).bg }]}>
                    <Text style={[styles.badgeText, { color: (SUB_STATUS[subscription.status] || SUB_STATUS.active).color }]}>
                      {(SUB_STATUS[subscription.status] || { text: subscription.status }).text}
                    </Text>
                  </View>
                </View>
                <Text style={styles.subPeriod}>
                  만료: {new Date(subscription.current_period_end).toLocaleDateString('ko-KR')}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="card-outline" size={24} color={COLORS.GRAY_300} />
                <Text style={styles.emptyText}>구독 없음</Text>
              </View>
            )}

            {/* 멤버 목록 */}
            <Text style={styles.sectionTitle}>멤버 ({members.length})</Text>
            {members.map((member) => {
              const role = ROLE_STYLE[member.role] || ROLE_STYLE.student;
              return (
                <Pressable
                  key={member.id}
                  style={styles.memberCard}
                  onPress={() => router.push(`/(admin)/user/${member.user_id}`)}
                >
                  <View style={styles.memberMain}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: role.bg }]}>
                      <Text style={[styles.badgeText, { color: role.color }]}>{role.text}</Text>
                    </View>
                  </View>
                  <Text style={styles.memberDate}>
                    가입: {new Date(member.created_at).toLocaleDateString('ko-KR')}
                  </Text>
                </Pressable>
              );
            })}
            {members.length === 0 && (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={24} color={COLORS.GRAY_300} />
                <Text style={styles.emptyText}>멤버가 없습니다</Text>
              </View>
            )}

            {/* 결제 내역 */}
            <Text style={styles.sectionTitle}>결제 내역</Text>
            {payments.map((payment) => {
              const status = PAY_STATUS[payment.status] || { text: payment.status, color: COLORS.GRAY_400 };
              return (
                <View key={payment.id} style={styles.paymentCard}>
                  <View style={styles.paymentMain}>
                    <View>
                      <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                      <Text style={styles.paymentDate}>
                        {new Date(payment.created_at).toLocaleDateString('ko-KR')}
                      </Text>
                    </View>
                    <View style={[styles.payBadge, { backgroundColor: status.color }]}>
                      <Text style={styles.payBadgeText}>{status.text}</Text>
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
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={24} color={COLORS.GRAY_300} />
                <Text style={styles.emptyText}>결제 내역이 없습니다</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BACKGROUND_SECONDARY },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  content: { padding: 16, paddingBottom: 40 },
  errorText: { color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium', marginBottom: 12 },

  // 카드
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  emptyCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
  },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginTop: 8 },

  // 학원 정보
  orgInfoRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  orgIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgName: { fontSize: 18, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY, marginBottom: 4 },
  orgMeta: { fontSize: 13, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  statLabel: { fontSize: 12, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY, marginTop: 2 },

  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 20,
    marginBottom: 12,
  },

  // 구독
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subPlan: { fontSize: 16, fontFamily: 'Pretendard-SemiBold', color: COLORS.TEXT_PRIMARY },
  subPeriod: { fontSize: 13, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginTop: 6 },

  // 뱃지
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontFamily: 'Pretendard-Medium' },

  // 멤버
  memberCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  memberMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', color: COLORS.TEXT_PRIMARY },
  memberEmail: { fontSize: 12, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  memberDate: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400, marginTop: 8 },

  // 결제
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
  payBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  payBadgeText: { fontSize: 10, fontFamily: 'Pretendard-Bold', color: COLORS.WHITE },
  paymentMeta: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400, marginTop: 6 },
  failureText: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.ERROR, marginTop: 4 },
});
