import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import { changeUserRole, getAuditLogs } from '@/services/admin';
import { supabase } from '@/lib/supabase';
import type { User, AdminAuditLog } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  teacher: '강사',
  student: '학생',
};

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!id) return;

    const { data, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setUser(data as User);
    }

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
              setUser(prev => prev ? { ...prev, role: newRole } : null);
              // Audit log 새로고침
              const { data: logData } = await getAuditLogs({ resourceType: 'user', limit: 10 });
              if (logData) setLogs(logData.filter(l => l.resource_id === id));
            }
            setIsChangingRole(false);
          },
        },
      ]
    );
  }, [user, id]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || '사용자를 찾을 수 없습니다'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>사용자 상세</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 프로필 */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name?.charAt(0) || '?'}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: user.role === 'admin' ? '#7C3AED' : user.role === 'teacher' ? COLORS.PRIMARY : COLORS.INFO }]}>
            <Text style={styles.roleBadgeText}>{ROLE_LABELS[user.role] || user.role}</Text>
          </View>
          <Text style={styles.joinDate}>
            가입: {new Date(user.created_at!).toLocaleDateString('ko-KR')}
          </Text>
        </View>

        {/* 역할 변경 */}
        {user.role !== 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>역할 변경</Text>
            <View style={styles.roleButtons}>
              {user.role !== 'teacher' && (
                <Pressable
                  style={[styles.roleButton, { backgroundColor: COLORS.PRIMARY }]}
                  onPress={() => handleRoleChange('teacher')}
                  disabled={isChangingRole}
                >
                  <Text style={styles.roleButtonText}>강사로 승격</Text>
                </Pressable>
              )}
              {user.role !== 'student' && (
                <Pressable
                  style={[styles.roleButton, { backgroundColor: COLORS.WARNING }]}
                  onPress={() => handleRoleChange('student')}
                  disabled={isChangingRole}
                >
                  <Text style={styles.roleButtonText}>학생으로 강등</Text>
                </Pressable>
              )}
            </View>
            {isChangingRole && <ActivityIndicator style={{ marginTop: 8 }} color={COLORS.PRIMARY} />}
          </View>
        )}

        {/* Audit Log */}
        {logs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>변경 이력</Text>
            {logs.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <Text style={styles.logAction}>{log.action}</Text>
                <Text style={styles.logDate}>
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
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BACKGROUND_SECONDARY },
  errorText: { color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  content: { padding: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontFamily: 'Pretendard-Bold', color: COLORS.PRIMARY },
  userName: { fontSize: 18, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY, marginBottom: 4 },
  userEmail: { fontSize: 13, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginBottom: 10 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  roleBadgeText: { fontSize: 12, fontFamily: 'Pretendard-Bold', color: COLORS.WHITE },
  joinDate: { fontSize: 12, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400 },
  section: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY, marginBottom: 12 },
  roleButtons: { flexDirection: 'row', gap: 10 },
  roleButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  roleButtonText: { fontSize: 13, fontFamily: 'Pretendard-Bold', color: COLORS.WHITE },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_100,
  },
  logAction: { fontSize: 13, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_PRIMARY },
  logDate: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400 },
});
