import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';
import { getUserMessage, classifyRpcError } from '@/lib/errors';
import { changeUserRole, getAuditLogs } from '@/services/admin';
import { supabase } from '@/lib/supabase';
import type { AdminAuditLog } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  super_admin: '슈퍼 관리자',
  admin: '관리자',
  teacher: '강사',
  student: '학생',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin: '#DC2626',
  admin: '#7C3AED',
  teacher: '#D4707F',
  student: '#E88B9A',
};

interface UserDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  platform_role: string | null;
  effective_role: string;
  created_at: string;
  organizations: Array<{
    org_id: string;
    org_name: string;
    org_role: string;
  }>;
}

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!id) return;

    const { data, error: rpcError } = await (supabase.rpc as CallableFunction)(
      'admin_get_user_by_id',
      { p_user_id: id }
    );

    if (rpcError) {
      setError(getUserMessage(rpcError));
      setIsLoading(false);
      return;
    }

    if (data?.error) {
      setError(classifyRpcError(data.error, { resource: 'user' }).userMessage);
      setIsLoading(false);
      return;
    }

    setUser(data as UserDetail);

    // 이 사용자 관련 audit log
    const { data: logData } = await getAuditLogs({ resourceType: 'user', limit: 10 });
    if (logData) {
      setLogs(logData.filter(l => l.resource_id === id));
    }

    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleRoleChange = useCallback(async (newRole: 'teacher' | 'student') => {
    if (!user) return;

    Alert.alert(
      '역할 변경',
      `${user.name}님을 ${ROLE_LABELS[newRole]}(으)로 변경하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '변경',
          onPress: async () => {
            setIsChangingRole(true);
            const { error: changeError } = await changeUserRole(user.id, newRole);

            if (changeError) {
              Alert.alert('오류', getUserMessage(changeError));
            } else {
              Alert.alert('완료', '역할이 변경되었습니다.');
              // RPC로 최신 데이터 다시 가져오기
              await fetchUser();
            }
            setIsChangingRole(false);
          },
        },
      ]
    );
  }, [user, fetchUser]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error || '사용자를 찾을 수 없습니다'}</Text>
      </View>
    );
  }

  const displayRole = user.effective_role;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>사용자 상세</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 프로필 */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{user.name?.charAt(0) || '?'}</Text>
          </View>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{user.name}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: ROLE_BADGE_COLORS[displayRole] || colors.textDisabled }]}>
            <Text style={styles.roleBadgeText}>{ROLE_LABELS[displayRole] || displayRole}</Text>
          </View>
          <Text style={[styles.joinDate, { color: colors.gray400 }]}>
            가입: {new Date(user.created_at).toLocaleDateString('ko-KR')}
          </Text>
        </View>

        {/* 소속 조직 */}
        {user.organizations.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>소속 조직</Text>
            {user.organizations.map((org) => (
              <View key={org.org_id} style={[styles.orgItem, { borderBottomColor: colors.gray100 }]}>
                <Text style={[styles.orgName, { color: colors.textPrimary }]}>{org.org_name}</Text>
                <Text style={[styles.orgRole, { color: colors.textSecondary }]}>
                  {ROLE_LABELS[org.org_role] || org.org_role}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 역할 변경 — super_admin/admin에게는 표시 안 함 */}
        {displayRole !== 'super_admin' && displayRole !== 'admin' && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>역할 변경</Text>
            <View style={styles.roleButtons}>
              {displayRole !== 'teacher' && (
                <Pressable
                  style={[styles.roleButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleRoleChange('teacher')}
                  disabled={isChangingRole}
                >
                  <Text style={styles.roleButtonText}>강사로 승격</Text>
                </Pressable>
              )}
              {displayRole !== 'student' && (
                <Pressable
                  style={[styles.roleButton, { backgroundColor: colors.warning }]}
                  onPress={() => handleRoleChange('student')}
                  disabled={isChangingRole}
                >
                  <Text style={styles.roleButtonText}>학생으로 강등</Text>
                </Pressable>
              )}
            </View>
            {isChangingRole && <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />}
          </View>
        )}

        {/* Audit Log */}
        {logs.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>변경 이력</Text>
            {logs.map((log) => (
              <View key={log.id} style={[styles.logItem, { borderBottomColor: colors.gray100 }]}>
                <Text style={[styles.logAction, { color: colors.textPrimary }]}>{log.action}</Text>
                <Text style={[styles.logDate, { color: colors.gray400 }]}>
                  {new Date(log.created_at).toLocaleDateString('ko-KR', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
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
  profileCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontFamily: 'Pretendard-Bold' },
  userName: { fontSize: 18, fontFamily: 'Pretendard-Bold', marginBottom: 4 },
  userEmail: { fontSize: 13, fontFamily: 'Pretendard-Regular', marginBottom: 10 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  roleBadgeText: { fontSize: 12, fontFamily: 'Pretendard-Bold', color: '#FFFFFF' },
  joinDate: { fontSize: 12, fontFamily: 'Pretendard-Regular' },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontFamily: 'Pretendard-Bold', marginBottom: 12 },
  roleButtons: { flexDirection: 'row', gap: 10 },
  roleButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  roleButtonText: { fontSize: 13, fontFamily: 'Pretendard-Bold', color: '#FFFFFF' },
  orgItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  orgName: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  orgRole: { fontSize: 12, fontFamily: 'Pretendard-Regular' },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  logAction: { fontSize: 13, fontFamily: 'Pretendard-Medium' },
  logDate: { fontSize: 11, fontFamily: 'Pretendard-Regular' },
});
