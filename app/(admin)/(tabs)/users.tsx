import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getUserMessage } from '@/lib/errors';
import { listUsers } from '@/services/admin';
import type { AdminUserListItem, EffectiveRole } from '@/lib/types';

type FilterRole = EffectiveRole | 'all';

const ROLE_LABELS: Record<string, string> = {
  all: '전체',
  super_admin: '슈퍼관리자',
  owner: '원장',
  teacher: '강사',
  student: '학생',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin: '#7C3AED',
  owner: '#2563EB',
  teacher: '#D4707F',
  student: '#E88B9A',
};

export default function AdminUsersScreen() {
  const colors = useThemeColors();

  function UserCard({ user }: { user: AdminUserListItem }) {
    return (
      <Pressable
        style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/(admin)/user/${user.id}`)}
      >
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>{user.name}</Text>
            <View style={[styles.roleBadge, { backgroundColor: ROLE_BADGE_COLORS[user.role] || colors.textDisabled }]}>
              <Text style={styles.roleBadgeText}>{ROLE_LABELS[user.role] || user.role}</Text>
            </View>
          </View>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
          <View style={styles.userMeta}>
            <Text style={[styles.userMetaText, { color: colors.textDisabled }]}>
              가입: {new Date(user.created_at).toLocaleDateString('ko-KR')}
            </Text>
            {user.org_name && (
              <Text style={[styles.userMetaText, { color: colors.textDisabled }]}>
                {user.org_name}
              </Text>
            )}
            {user.subscription_plan && (
              <Text style={[styles.userMetaText, { color: colors.textDisabled }]}>
                플랜: {user.subscription_plan}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      </Pressable>
    );
  }

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterRole>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await listUsers({
      role: filter === 'all' ? undefined : filter,
      search: search.trim() || undefined,
      limit: 50,
    });

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setUsers(data || []);
    }
    setIsLoading(false);
  }, [filter, search]);

  useEffect(() => {
    setIsLoading(true);
    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [fetchUsers]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchUsers();
    setIsRefreshing(false);
  }, [fetchUsers]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* 검색바 */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textDisabled} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="이름 또는 이메일 검색..."
          placeholderTextColor={colors.textDisabled}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textDisabled} />
          </Pressable>
        )}
      </View>

      {/* 필터 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {(['all', 'super_admin', 'owner', 'teacher', 'student'] as FilterRole[]).map((role) => (
          <Pressable
            key={role}
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              filter === role && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setFilter(role)}
          >
            <Text style={[styles.filterChipText, { color: colors.textSecondary }, filter === role && { color: '#FFFFFF' }]}>
              {ROLE_LABELS[role]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 목록 */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          <Text style={[styles.countText, { color: colors.textSecondary }]}>{users.length}명</Text>
          {users.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
          {users.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>사용자가 없습니다</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 0,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },
  filterRow: { maxHeight: 44, marginTop: 12 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  listContent: { padding: 16 },
  countText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userName: { fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleBadgeText: { fontSize: 10, fontFamily: 'Pretendard-Bold', color: '#FFFFFF' },
  userEmail: { fontSize: 13, fontFamily: 'Pretendard-Regular', marginBottom: 4 },
  userMeta: { flexDirection: 'row', gap: 12 },
  userMetaText: { fontSize: 11, fontFamily: 'Pretendard-Regular' },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
});
