import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getUserMessage } from '@/lib/errors';
import { getAdminDashboardStats, listOrganizations } from '@/services/admin';
import { adminGetSubscriptionStats } from '@/services/billing';
import type { AdminDashboardStats, SubscriptionStats } from '@/lib/types';

export default function AdminDashboard() {
  const colors = useThemeColors();

  function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
      <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{value}</Text>
        {sub && <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>{sub}</Text>}
      </View>
    );
  }

  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [subStats, setSubStats] = useState<SubscriptionStats | null>(null);
  const [orgCount, setOrgCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);

    const [statsResult, subResult, orgsResult] = await Promise.all([
      getAdminDashboardStats(),
      adminGetSubscriptionStats(),
      listOrganizations(),
    ]);

    if (statsResult.error) {
      setError(getUserMessage(statsResult.error));
    } else {
      setStats(statsResult.data);
    }

    if (subResult.data) {
      setSubStats(subResult.data);
    }

    if (orgsResult.data) {
      setOrgCount(orgsResult.data.length);
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
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      </View>
    );
  }

  const formatCurrency = (amount: number) =>
    `\u20A9${amount.toLocaleString()}`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {/* 사용자 KPI */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>사용자</Text>
      <View style={styles.kpiRow}>
        <KpiCard label="전체 사용자" value={stats?.total_users ?? 0} />
        <KpiCard label="강사" value={stats?.total_teachers ?? 0} />
        <KpiCard label="학생" value={stats?.total_students ?? 0} />
      </View>
      <View style={styles.kpiRow}>
        <KpiCard label="7일 활성" value={stats?.active_users_7d ?? 0} />
        <KpiCard label="30일 활성" value={stats?.active_users_30d ?? 0} />
        <KpiCard label="등록 학원" value={orgCount} />
      </View>

      {/* 콘텐츠 KPI */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>콘텐츠</Text>
      <View style={styles.kpiRow}>
        <KpiCard label="총 스크립트" value={stats?.total_scripts ?? 0} />
        <KpiCard label="총 연습" value={stats?.total_practices ?? 0} />
      </View>

      {/* 구독/수익 KPI */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>구독 & 수익</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>플랜별 분포</Text>
          {subStats.plan_distribution.map((plan) => (
            <View key={plan.plan_key} style={[styles.planRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.planName, { color: colors.textPrimary }]}>{plan.plan_name}</Text>
              <Text style={[styles.planCount, { color: colors.primary }]}>{plan.count}명</Text>
            </View>
          ))}
        </>
      )}

      {/* 바로가기 */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>바로가기</Text>
      <View style={styles.shortcutGrid}>
        <Pressable style={[styles.shortcutCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/(tabs)/users')}>
          <Ionicons name="people" size={24} color={colors.primary} />
          <Text style={[styles.shortcutLabel, { color: colors.textPrimary }]}>사용자 관리</Text>
        </Pressable>
        <Pressable style={[styles.shortcutCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/(tabs)/academies')}>
          <Ionicons name="business" size={24} color="#7C3AED" />
          <Text style={[styles.shortcutLabel, { color: colors.textPrimary }]}>학원 관리</Text>
        </Pressable>
        <Pressable style={[styles.shortcutCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/(tabs)/billing')}>
          <Ionicons name="card" size={24} color={colors.secondary} />
          <Text style={[styles.shortcutLabel, { color: colors.textPrimary }]}>결제 관리</Text>
        </Pressable>
        <Pressable style={[styles.shortcutCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/(tabs)/landing')}>
          <Ionicons name="globe" size={24} color="#F59E0B" />
          <Text style={[styles.shortcutLabel, { color: colors.textPrimary }]}>랜딩 관리</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    marginTop: 20,
    marginBottom: 12,
  },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  kpiLabel: { fontSize: 12, fontFamily: 'Pretendard-Medium', marginBottom: 4 },
  kpiValue: { fontSize: 22, fontFamily: 'Pretendard-Bold' },
  kpiSub: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  planName: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  planCount: { fontSize: 14, fontFamily: 'Pretendard-Bold' },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shortcutCard: {
    width: '47%' as any,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  shortcutLabel: { fontSize: 13, fontFamily: 'Pretendard-Medium' },
});
