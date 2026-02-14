import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import { listUsers } from '@/services/admin';
import type { AdminUserListItem, UserRole } from '@/lib/types';

type FilterRole = UserRole | 'all';

const ROLE_LABELS: Record<string, string> = {
  all: '전체',
  admin: '관리자',
  teacher: '강사',
  student: '학생',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: '#7C3AED',
  teacher: COLORS.PRIMARY,
  student: COLORS.INFO,
};

function UserCard({ user }: { user: AdminUserListItem }) {
  return (
    <Pressable
      style={styles.userCard}
      onPress={() => router.push(`/(admin)/user/${user.id}`)}
    >
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName}>{user.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: ROLE_BADGE_COLORS[user.role] || COLORS.GRAY_400 }]}>
            <Text style={styles.roleBadgeText}>{ROLE_LABELS[user.role] || user.role}</Text>
          </View>
        </View>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.userMeta}>
          <Text style={styles.userMetaText}>
            가입: {new Date(user.created_at).toLocaleDateString('ko-KR')}
          </Text>
          {user.subscription_plan && (
            <Text style={styles.userMetaText}>
              플랜: {user.subscription_plan}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.GRAY_400} />
    </Pressable>
  );
}

export default function AdminUsersScreen() {
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
    <View style={styles.container}>
      {/* 검색바 */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.GRAY_400} />
        <TextInput
          style={styles.searchInput}
          placeholder="이름 또는 이메일 검색..."
          placeholderTextColor={COLORS.GRAY_400}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.GRAY_400} />
          </Pressable>
        )}
      </View>

      {/* 필터 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {(['all', 'admin', 'teacher', 'student'] as FilterRole[]).map((role) => (
          <Pressable
            key={role}
            style={[styles.filterChip, filter === role && styles.filterChipActive]}
            onPress={() => setFilter(role)}
          >
            <Text style={[styles.filterChipText, filter === role && styles.filterChipTextActive]}>
              {ROLE_LABELS[role]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 목록 */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.PRIMARY} />
          }
        >
          <Text style={styles.countText}>{users.length}명</Text>
          {users.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
          {users.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>사용자가 없습니다</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    margin: 16,
    marginBottom: 0,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_PRIMARY,
  },
  filterRow: { maxHeight: 44, marginTop: 12 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  filterChipActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
  },
  filterChipTextActive: { color: COLORS.WHITE },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium' },
  listContent: { padding: 16 },
  countText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userName: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: COLORS.TEXT_PRIMARY },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleBadgeText: { fontSize: 10, fontFamily: 'Pretendard-Bold', color: COLORS.WHITE },
  userEmail: { fontSize: 13, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginBottom: 4 },
  userMeta: { flexDirection: 'row', gap: 12 },
  userMetaText: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400 },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },
});
