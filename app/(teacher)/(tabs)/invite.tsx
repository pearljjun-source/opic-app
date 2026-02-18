import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useState, useEffect, useCallback } from 'react';

import { APP_CONFIG, ORG_ROLE_LABELS } from '@/lib/constants';
import { createInvite, getActiveInvite, deleteInvite } from '@/services/invites';
import { InviteCodeCard } from '@/components/teacher';
import { useAuth } from '@/hooks/useAuth';
import { canInviteTeacher } from '@/lib/permissions';
import type { Invite, OrgRole } from '@/lib/types';
import { getUserMessage } from '@/lib/errors';
import { useThemeColors } from '@/hooks/useTheme';

/**
 * 초대 화면
 *
 * 기능:
 * - 활성 초대 코드가 있으면 표시
 * - 없으면 새로 생성 가능
 * - owner: 학생 + 강사 초대를 독립적으로 관리 (동시 가능)
 * - teacher: 학생 초대만 가능
 * - 코드 삭제 가능
 */
export default function InviteScreen() {
  const { orgRole } = useAuth();
  const colors = useThemeColors();
  const canInviteTeachers = canInviteTeacher(orgRole);

  const [studentInvite, setStudentInvite] = useState<Invite | null>(null);
  const [teacherInvite, setTeacherInvite] = useState<Invite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [creatingRole, setCreatingRole] = useState<OrgRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 활성 초대 코드 조회
  const fetchActiveInvites = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // owner는 student + teacher 둘 다 조회, teacher는 student만
    const requests: Promise<{ data: Invite | null; error: Error | null }>[] = [
      getActiveInvite('student'),
    ];
    if (canInviteTeachers) {
      requests.push(getActiveInvite('teacher'));
    }

    const results = await Promise.all(requests);

    const studentResult = results[0];
    if (studentResult.error) {
      setError(getUserMessage(studentResult.error));
    } else {
      setStudentInvite(studentResult.data);
    }

    if (canInviteTeachers && results[1]) {
      const teacherResult = results[1];
      if (teacherResult.error) {
        setError(getUserMessage(teacherResult.error));
      } else {
        setTeacherInvite(teacherResult.data);
      }
    }

    setIsLoading(false);
  }, [canInviteTeachers]);

  useEffect(() => {
    fetchActiveInvites();
  }, [fetchActiveInvites]);

  // 초대 코드 생성
  const handleCreateInvite = async (targetRole: OrgRole) => {
    setCreatingRole(targetRole);
    setError(null);

    const result = await createInvite(APP_CONFIG.INVITE_EXPIRE_DAYS, targetRole);

    if (result.success && result.invite_id) {
      // 해당 역할의 초대만 다시 조회
      const { data, error: fetchError } = await getActiveInvite(targetRole);
      if (fetchError) {
        setError(getUserMessage(fetchError));
      } else if (targetRole === 'student') {
        setStudentInvite(data);
      } else {
        setTeacherInvite(data);
      }
    } else {
      setError(result.error || '초대 코드 생성에 실패했습니다.');
    }

    setCreatingRole(null);
  };

  // 초대 코드 삭제
  const handleDeleteInvite = (invite: Invite, role: OrgRole) => {
    Alert.alert(
      '초대 코드 삭제',
      '이 초대 코드를 삭제하시겠습니까?\n삭제 후 새 코드를 생성할 수 있습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const { error: deleteError } = await deleteInvite(invite.id);

            if (deleteError) {
              setError(getUserMessage(deleteError));
            } else {
              if (role === 'student') {
                setStudentInvite(null);
              } else {
                setTeacherInvite(null);
              }
            }
          },
        },
      ]
    );
  };

  // 로딩 중
  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>로딩 중...</Text>
      </View>
    );
  }

  // 단일 섹션 렌더링 (초대 카드 또는 생성 버튼)
  const renderInviteSection = (role: OrgRole) => {
    const invite = role === 'student' ? studentInvite : teacherInvite;
    const isCreating = creatingRole === role;
    const roleLabel = ORG_ROLE_LABELS[role];

    if (invite) {
      return (
        <InviteCodeCard
          invite={invite}
          targetRole={role}
          onDelete={() => handleDeleteInvite(invite, role)}
        />
      );
    }

    return (
      <View style={[styles.createSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.createDescription, { color: colors.textSecondary }]}>
          {role === 'teacher'
            ? '새 초대 코드를 생성하여 강사를 초대하세요.'
            : '새 초대 코드를 생성하여 학생을 초대하세요.'}
          {'\n'}코드는 {APP_CONFIG.INVITE_EXPIRE_DAYS}일간 유효합니다.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }, isCreating && styles.buttonDisabled]}
          onPress={() => handleCreateInvite(role)}
          disabled={isCreating}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{roleLabel} 초대 코드 생성</Text>
          )}
        </Pressable>
      </View>
    );
  };

  // owner가 아닌 teacher: 학생 초대만 표시 (기존과 유사한 단일 화면)
  if (!canInviteTeachers) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.accentRedBg }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {studentInvite ? (
          <InviteCodeCard
            invite={studentInvite}
            targetRole="student"
            onDelete={() => handleDeleteInvite(studentInvite, 'student')}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>활성 초대 코드가 없습니다</Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
              새 초대 코드를 생성하여 학생을 초대하세요.{'\n'}
              코드는 {APP_CONFIG.INVITE_EXPIRE_DAYS}일간 유효합니다.
            </Text>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }, creatingRole === 'student' && styles.buttonDisabled]}
              onPress={() => handleCreateInvite('student')}
              disabled={creatingRole === 'student'}
            >
              {creatingRole === 'student' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>학생 초대 코드 생성</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // owner: 학생 + 강사 초대를 독립적으로 관리
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surfaceSecondary }]} contentContainerStyle={styles.scrollContent}>
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.accentRedBg }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {/* 학생 초대 섹션 */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{ORG_ROLE_LABELS.student} 초대</Text>
        {renderInviteSection('student')}
      </View>

      {/* 강사 초대 섹션 */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{ORG_ROLE_LABELS.teacher} 초대</Text>
        {renderInviteSection('teacher')}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 12,
  },
  createSection: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  createDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
});
