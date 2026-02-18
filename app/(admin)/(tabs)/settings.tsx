import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { useThemeColors, useThemeControl, loadThemePreference, ThemePreference } from '@/hooks/useTheme';
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

function ThemeRow({ icon, label, onPress, selected }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeRow,
        selected && { backgroundColor: colors.primaryLight },
        pressed && !selected && { backgroundColor: colors.surfaceSecondary },
      ]}
    >
      <Ionicons name={icon} size={20} color={selected ? colors.primary : colors.textSecondary} />
      <Text style={[styles.themeLabel, { color: colors.textPrimary }]}>{label}</Text>
      {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
    </Pressable>
  );
}

export default function AdminSettingsScreen() {
  const { signOut } = useAuth();
  const colors = useThemeColors();
  const { setThemePreference } = useThemeControl();
  const [themePref, setThemePref] = useState<ThemePreference>('system');
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadThemePreference().then(setThemePref);
  }, []);

  const handleThemeChange = async (pref: ThemePreference) => {
    setThemePref(pref);
    await setThemePreference(pref);
  };

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
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {/* 테마 */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>테마</Text>
      <View style={[styles.themeCard, { backgroundColor: colors.surface }]}>
        <ThemeRow icon="phone-portrait-outline" label="시스템 설정" onPress={() => handleThemeChange('system')} selected={themePref === 'system'} />
        <View style={[styles.themeDivider, { backgroundColor: colors.borderLight }]} />
        <ThemeRow icon="sunny-outline" label="라이트" onPress={() => handleThemeChange('light')} selected={themePref === 'light'} />
        <View style={[styles.themeDivider, { backgroundColor: colors.borderLight }]} />
        <ThemeRow icon="moon-outline" label="다크" onPress={() => handleThemeChange('dark')} selected={themePref === 'dark'} />
      </View>

      {/* 로그아웃 */}
      <Pressable style={[styles.logoutButton, { backgroundColor: colors.error }]} onPress={handleSignOut}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>

      {/* Audit Log */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>감사 로그</Text>
      <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>관리자 활동 기록 (변조 불가)</Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : (
        <>
          {logs.map((log) => (
            <View key={log.id} style={[styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.logHeader}>
                <Text style={[styles.logAction, { color: colors.textPrimary }]}>
                  {ACTION_LABELS[log.action] || log.action}
                </Text>
                <Text style={[styles.logDate, { color: colors.textDisabled }]}>
                  {new Date(log.created_at).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={[styles.logResource, { color: colors.textSecondary }]}>
                {RESOURCE_LABELS[log.resource_type] || log.resource_type}
                {log.resource_id ? ` (${log.resource_id.slice(0, 8)}...)` : ''}
              </Text>
              <Text style={[styles.logHash, { color: colors.textDisabled }]} numberOfLines={1}>
                Hash: {log.content_hash.slice(0, 16)}...
              </Text>
            </View>
          ))}
          {logs.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>기록이 없습니다</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  errorText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  logoutButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Pretendard-Bold' },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 16,
  },
  themeCard: {
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    marginTop: 8,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderRadius: 12,
  },
  themeLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
  themeDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  logCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  logAction: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },
  logDate: { fontSize: 11, fontFamily: 'Pretendard-Regular' },
  logResource: { fontSize: 12, fontFamily: 'Pretendard-Medium', marginBottom: 4 },
  logHash: { fontSize: 10, fontFamily: 'Pretendard-Regular' },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
});
