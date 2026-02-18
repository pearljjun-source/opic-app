import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ORG_ROLE_LABELS } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { canManageOrg } from '@/lib/permissions';
import { getOrgTeachers, removeOrgMember, changeMemberRole } from '@/services/organizations';
import { getUserMessage } from '@/lib/errors';
import type { OrgTeacherItem, OrgRole } from '@/lib/types';
import { useThemeColors } from '@/hooks/useTheme';

export default function TeacherManagementScreen() {
  const colors = useThemeColors();
  const { currentOrg, orgRole, refreshUser } = useAuth();
  const [teachers, setTeachers] = useState<OrgTeacherItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeachers = useCallback(async () => {
    if (!currentOrg) return;

    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await getOrgTeachers(currentOrg.id);

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setTeachers(data || []);
    }

    setIsLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleRemoveMember = (teacher: OrgTeacherItem) => {
    if (!currentOrg) return;

    Alert.alert(
      '멤버 제거',
      `${teacher.name} 님을 학원에서 제거하시겠습니까?\n해당 강사의 학생 연결은 유지됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '제거',
          style: 'destructive',
          onPress: async () => {
            const result = await removeOrgMember(currentOrg.id, teacher.id);
            if (result.success) {
              await fetchTeachers();
              refreshUser();
            } else {
              Alert.alert('오류', result.error || '멤버 제거에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleRoleChange = (teacher: OrgTeacherItem) => {
    if (!currentOrg) return;

    const newRole: OrgRole = teacher.role === 'owner' ? 'teacher' : 'owner';
    const newRoleLabel = ORG_ROLE_LABELS[newRole];

    Alert.alert(
      '역할 변경',
      `${teacher.name} 님의 역할을 "${newRoleLabel}"(으)로 변경하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '변경',
          onPress: async () => {
            const result = await changeMemberRole(currentOrg.id, teacher.id, newRole);
            if (result.success) {
              await fetchTeachers();
              refreshUser();
            } else {
              Alert.alert('오류', result.error || '역할 변경에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  if (!currentOrg || !canManageOrg(orgRole)) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.gray300} />
        <Text style={[styles.guardText, { color: colors.textSecondary }]}>접근 권한이 없습니다</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surfaceSecondary }]} contentContainerStyle={styles.contentContainer}>
      {/* 헤더: 강사 수 + 초대 버튼 */}
      <View style={styles.headerRow}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>{teachers.length}명</Text>
        <Pressable
          style={({ pressed }) => [styles.inviteButton, { backgroundColor: colors.primaryLight }, pressed && styles.inviteButtonPressed]}
          onPress={() => router.push('/(teacher)/(tabs)/invite' as any)}
        >
          <Ionicons name="person-add-outline" size={16} color={colors.primary} />
          <Text style={[styles.inviteButtonText, { color: colors.primary }]}>강사 초대</Text>
        </Pressable>
      </View>

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.accentRedBg }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : teachers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={colors.gray300} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>소속 강사가 없습니다</Text>
          <Text style={[styles.emptySubtext, { color: colors.textDisabled }]}>초대 탭에서 강사를 초대하세요</Text>
        </View>
      ) : (
        teachers.map((teacher) => (
          <View key={teacher.id} style={[styles.teacherCard, { backgroundColor: colors.surface }]}>
            <View style={styles.teacherInfo}>
              <View style={styles.teacherNameRow}>
                <Text style={[styles.teacherName, { color: colors.textPrimary }]}>{teacher.name}</Text>
                <Pressable
                  onPress={() => handleRoleChange(teacher)}
                  hitSlop={6}
                >
                  <View style={[styles.roleBadge, { backgroundColor: colors.borderLight }, teacher.role === 'owner' && { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.roleBadgeText, { color: colors.textSecondary }, teacher.role === 'owner' && { color: colors.primary }]}>
                      {ORG_ROLE_LABELS[teacher.role]}
                    </Text>
                  </View>
                </Pressable>
              </View>
              <Text style={[styles.teacherEmail, { color: colors.textSecondary }]}>{teacher.email}</Text>
              <Text style={[styles.teacherStats, { color: colors.textDisabled }]}>학생 {teacher.students_count}명</Text>
            </View>
            {teacher.role !== 'owner' && (
              <Pressable
                style={styles.removeButton}
                onPress={() => handleRemoveMember(teacher)}
                hitSlop={8}
              >
                <Ionicons name="close-circle-outline" size={22} color={colors.textDisabled} />
              </Pressable>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  guardText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  countText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  inviteButtonPressed: {
    opacity: 0.7,
  },
  inviteButtonText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  teacherCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teacherInfo: {
    flex: 1,
  },
  teacherNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
  },
  teacherEmail: {
    fontSize: 13,
    marginBottom: 2,
  },
  teacherStats: {
    fontSize: 12,
  },
  removeButton: {
    padding: 4,
  },
});
