import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import { useAuth } from '@/hooks/useAuth';
import { getAuditLogs } from '@/services/admin';
import type { AdminAuditLog } from '@/lib/types';

const ACTION_LABELS: Record<string, string> = {
  user_role_change: '역할 변경',
  landing_update: '랜딩 수정',
  landing_item_create: '아이템 생성',
  landing_item_delete: '아이템 삭제',
  landing_reorder: '순서 변경',
  plan_update: '플랜 수정',
  subscription_change: '구독 변경',
  system_config: '시스템 설정',
};

const RESOURCE_LABELS: Record<string, string> = {
  user: '사용자',
  landing_section: '랜딩 섹션',
  landing_item: '랜딩 아이템',
  subscription: '구독',
  plan: '플랜',
  system: '시스템',
};

export default function AdminSettingsScreen() {
  const { signOut } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await getAuditLogs({ limit: 30 });

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setLogs(data || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchLogs();
    setIsRefreshing(false);
  }, [fetchLogs]);

  const handleSignOut = useCallback(() => {
    Alert.alert('로그아웃', '로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: signOut },
    ]);
  }, [signOut]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.PRIMARY} />
      }
    >
      {/* 로그아웃 */}
      <Pressable style={styles.logoutButton} onPress={handleSignOut}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>

      {/* Audit Log */}
      <Text style={styles.sectionTitle}>감사 로그</Text>
      <Text style={styles.sectionDesc}>관리자 활동 기록 (변조 불가)</Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          {logs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.logAction}>
                  {ACTION_LABELS[log.action] || log.action}
                </Text>
                <Text style={styles.logDate}>
                  {new Date(log.created_at).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.logResource}>
                {RESOURCE_LABELS[log.resource_type] || log.resource_type}
                {log.resource_id ? ` (${log.resource_id.slice(0, 8)}...)` : ''}
              </Text>
              <Text style={styles.logHash} numberOfLines={1}>
                Hash: {log.content_hash.slice(0, 16)}...
              </Text>
            </View>
          ))}
          {logs.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>기록이 없습니다</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  content: { padding: 16, paddingBottom: 40 },
  center: { justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  errorText: { color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium' },
  logoutButton: {
    backgroundColor: COLORS.ERROR,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutText: { color: COLORS.WHITE, fontSize: 15, fontFamily: 'Pretendard-Bold' },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 16,
  },
  logCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  logAction: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', color: COLORS.TEXT_PRIMARY },
  logDate: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400 },
  logResource: { fontSize: 12, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY, marginBottom: 4 },
  logHash: { fontSize: 10, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400 },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },
});
