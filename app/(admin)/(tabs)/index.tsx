import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import { getAdminDashboardStats } from '@/services/admin';
import { adminGetSubscriptionStats } from '@/services/billing';
import type { AdminDashboardStats, SubscriptionStats } from '@/lib/types';

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [subStats, setSubStats] = useState<SubscriptionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);

    const [statsResult, subResult] = await Promise.all([
      getAdminDashboardStats(),
      adminGetSubscriptionStats(),
    ]);

    if (statsResult.error) {
      setError(getUserMessage(statsResult.error));
    } else {
      setStats(statsResult.data);
    }

    if (subResult.data) {
      setSubStats(subResult.data);
    }

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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const formatCurrency = (amount: number) =>
    `\u20A9${amount.toLocaleString()}`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.PRIMARY} />
      }
    >
      {/* 사용자 KPI */}
      <Text style={styles.sectionTitle}>사용자</Text>
      <View style={styles.kpiRow}>
        <KpiCard label="전체 사용자" value={stats?.total_users ?? 0} />
        <KpiCard label="강사" value={stats?.total_teachers ?? 0} />
        <KpiCard label="학생" value={stats?.total_students ?? 0} />
      </View>
      <View style={styles.kpiRow}>
        <KpiCard label="7일 활성" value={stats?.active_7d ?? 0} />
        <KpiCard label="30일 활성" value={stats?.active_30d ?? 0} />
      </View>

      {/* 구독/수익 KPI */}
      <Text style={styles.sectionTitle}>구독 & 수익</Text>
      <View style={styles.kpiRow}>
        <KpiCard label="MRR" value={formatCurrency(subStats?.mrr ?? 0)} />
        <KpiCard label="구독자" value={subStats?.total_subscribers ?? 0} />
      </View>
      <View style={styles.kpiRow}>
        <KpiCard label="ARR" value={formatCurrency(subStats?.arr ?? 0)} />
        <KpiCard
          label="이탈률"
          value={`${((subStats?.churn_rate ?? 0) * 100).toFixed(1)}%`}
        />
      </View>

      {/* 플랜별 분포 */}
      {subStats?.plan_distribution && subStats.plan_distribution.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>플랜별 분포</Text>
          {subStats.plan_distribution.map((plan) => (
            <View key={plan.plan_key} style={styles.planRow}>
              <Text style={styles.planName}>{plan.plan_name}</Text>
              <Text style={styles.planCount}>{plan.count}명</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BACKGROUND_SECONDARY },
  errorText: { color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium' },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 20,
    marginBottom: 12,
  },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  kpiLabel: { fontSize: 12, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  kpiSub: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  planName: { fontSize: 14, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_PRIMARY },
  planCount: { fontSize: 14, fontFamily: 'Pretendard-Bold', color: COLORS.PRIMARY },
});
