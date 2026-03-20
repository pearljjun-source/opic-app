import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { APP_CONFIG, ORG_ROLE_LABELS } from '@/lib/constants';
import { createInvite, getActiveInvites, deleteInvite } from '@/services/invites';
import { getTeacherClasses } from '@/services/classes';
import { InviteCodeCard, InviteQRModal } from '@/components/teacher';
import { useAuth } from '@/hooks/useAuth';
import { canInviteTeacher } from '@/lib/permissions';
import type { InviteWithClass, OrgRole } from '@/lib/types';
import { getUserMessage } from '@/lib/errors';
import { useThemeColors } from '@/hooks/useTheme';
import { getRemainingQuota } from '@/services/billing';
import { QuotaIndicator } from '@/components/ui';
import { alert as xAlert, confirm as xConfirm } from '@/lib/alert';

const MAX_USES_OPTIONS = APP_CONFIG.INVITE_MAX_USES_OPTIONS;
const MAX_USES_LABELS: Record<number, string> = {
  1: '1회용',
  10: '10명',
  30: '30명',
  50: '50명',
  0: '무제한',
};

/**
 * 초대 화면
 *
 * 기능:
 * - 활성 초대 코드를 리스트로 표시 (여러 개 동시 가능)
 * - 반 선택 + 사용 횟수 선택 후 코드 생성 (학생)
 * - owner: 학생 + 강사 초대를 독립적으로 관리
 * - teacher: 학생 초대만 가능
 * - 코드 삭제, 링크 복사, QR 공유 지원
 */
export default function InviteScreen() {
  const { orgRole } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();
  const canInviteTeachers = canInviteTeacher(orgRole);

  const [studentInvites, setStudentInvites] = useState<InviteWithClass[]>([]);
  const [teacherInvites, setTeacherInvites] = useState<InviteWithClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [creatingRole, setCreatingRole] = useState<OrgRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studentQuota, setStudentQuota] = useState<{ used: number; limit: number } | null>(null);

  // 반 목록 (학생 초대 시 선택)
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedMaxUses, setSelectedMaxUses] = useState<number>(30);

  // QR 모달
  const [qrInvite, setQrInvite] = useState<InviteWithClass | null>(null);

  // 반 목록 로드
  useEffect(() => {
    getTeacherClasses().then(({ data }) => {
      if (data) {
        setClasses(data.map((c: any) => ({ id: c.id, name: c.name })));
      }
    });
  }, []);

  // 활성 초대 코드 + 쿼터 조회
  const fetchActiveInvites = useCallback(async () => {
    setError(null);

    const requests: Promise<{ data: InviteWithClass[]; error: Error | null }>[] = [
      getActiveInvites('student'),
    ];
    if (canInviteTeachers) {
      requests.push(getActiveInvites('teacher'));
    }

    // 쿼터 병렬 조회
    getRemainingQuota('students').then((q) => {
      if (q.limit != null) setStudentQuota({ used: q.used, limit: q.limit });
    });

    const results = await Promise.all(requests);

    const studentResult = results[0];
    if (studentResult.error) {
      setError(getUserMessage(studentResult.error));
    } else {
      setStudentInvites(studentResult.data);
    }

    if (canInviteTeachers && results[1]) {
      const teacherResult = results[1];
      if (teacherResult.error) {
        setError(getUserMessage(teacherResult.error));
      } else {
        setTeacherInvites(teacherResult.data);
      }
    }
  }, [canInviteTeachers]);

  useEffect(() => {
    fetchActiveInvites().finally(() => setIsLoading(false));
  }, [fetchActiveInvites]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchActiveInvites();
    setIsRefreshing(false);
  }, [fetchActiveInvites]);

  // 초대 코드 생성
  const handleCreateInvite = async (targetRole: OrgRole) => {
    setCreatingRole(targetRole);
    setError(null);

    // 학생 초대 시 쿼터 체크
    if (targetRole === 'student') {
      const quota = await getRemainingQuota('students');
      if (!quota.allowed) {
        if (orgRole === 'owner') {
          xConfirm(
            '학생 수 한도 도달',
            `현재 플랜의 학생 수 한도(${quota.limit}명)에 도달했습니다. 플랜을 업그레이드하시겠습니까?`,
            () => router.push('/(teacher)/manage/plan-select'),
            { confirmText: '업그레이드', cancelText: '확인' }
          );
        } else {
          xAlert(
            '학생 수 한도 도달',
            `현재 플랜의 학생 수 한도(${quota.limit}명)에 도달했습니다. 원장에게 플랜 업그레이드를 요청해 주세요.`
          );
        }
        setCreatingRole(null);
        return;
      }
    }

    const classId = targetRole === 'student' ? (selectedClassId || undefined) : undefined;
    const maxUses = targetRole === 'student' ? selectedMaxUses : 1;

    // 동일 반에 활성 코드가 이미 있으면 중복 생성 방지
    if (classId) {
      const existingForClass = studentInvites.find(i => i.class_id === classId);
      if (existingForClass) {
        const className = existingForClass.classes?.name || '해당 반';
        xAlert(
          '이미 활성 코드 존재',
          `${className}에 이미 활성 초대 코드(${existingForClass.code})가 있습니다. 기존 코드를 삭제한 후 새로 생성해 주세요.`
        );
        setCreatingRole(null);
        return;
      }
    }

    const result = await createInvite(APP_CONFIG.INVITE_EXPIRE_DAYS, targetRole, classId, maxUses);

    if (result.success) {
      // 해당 역할의 초대 목록 새로고침
      const { data, error: fetchError } = await getActiveInvites(targetRole);
      if (fetchError) {
        setError(getUserMessage(fetchError));
      } else if (targetRole === 'student') {
        setStudentInvites(data);
      } else {
        setTeacherInvites(data);
      }
    } else {
      setError(result.error || '초대 코드 생성에 실패했습니다.');
    }

    setCreatingRole(null);
  };

  // 초대 코드 삭제
  const handleDeleteInvite = (invite: InviteWithClass, role: OrgRole) => {
    xConfirm(
      '초대 코드 삭제',
      `코드 ${invite.code}를 삭제하시겠습니까?`,
      async () => {
        const { error: deleteError } = await deleteInvite(invite.id);

        if (deleteError) {
          setError(getUserMessage(deleteError));
        } else {
          if (role === 'student') {
            setStudentInvites(prev => prev.filter(i => i.id !== invite.id));
          } else {
            setTeacherInvites(prev => prev.filter(i => i.id !== invite.id));
          }
        }
      },
      { confirmText: '삭제' }
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

  // 반 선택기 (학생 초대 전용)
  const renderClassSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>반 선택</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <Pressable
          style={[
            styles.chip,
            { borderColor: !selectedClassId ? colors.primary : colors.border },
            !selectedClassId && { backgroundColor: colors.primaryLight },
          ]}
          onPress={() => setSelectedClassId(null)}
        >
          <Text style={[styles.chipText, { color: !selectedClassId ? colors.primary : colors.textSecondary }]}>
            전체
          </Text>
        </Pressable>
        {classes.map((cls) => (
          <Pressable
            key={cls.id}
            style={[
              styles.chip,
              { borderColor: selectedClassId === cls.id ? colors.primary : colors.border },
              selectedClassId === cls.id && { backgroundColor: colors.primaryLight },
            ]}
            onPress={() => setSelectedClassId(cls.id)}
          >
            <Text style={[styles.chipText, { color: selectedClassId === cls.id ? colors.primary : colors.textSecondary }]}>
              {cls.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={[styles.selectorLabel, { color: colors.textSecondary, marginTop: 12 }]}>사용 횟수</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {MAX_USES_OPTIONS.map((n) => (
          <Pressable
            key={n}
            style={[
              styles.chip,
              { borderColor: selectedMaxUses === n ? colors.primary : colors.border },
              selectedMaxUses === n && { backgroundColor: colors.primaryLight },
            ]}
            onPress={() => setSelectedMaxUses(n)}
          >
            <Text style={[styles.chipText, { color: selectedMaxUses === n ? colors.primary : colors.textSecondary }]}>
              {MAX_USES_LABELS[n] || `${n}명`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  // 섹션 렌더링: 생성 버튼 + 코드 리스트
  const renderInviteSection = (role: 'student' | 'teacher') => {
    const invites = role === 'student' ? studentInvites : teacherInvites;
    const isCreating = creatingRole === role;
    const roleLabel = ORG_ROLE_LABELS[role];

    return (
      <View>
        {/* 학생 초대: 반 선택 + 사용 횟수 */}
        {role === 'student' && classes.length > 0 && renderClassSelector()}

        {/* 생성 버튼 */}
        <Pressable
          style={[styles.createButton, { backgroundColor: colors.primary }, isCreating && styles.buttonDisabled]}
          onPress={() => handleCreateInvite(role)}
          disabled={isCreating}
          hitSlop={4}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>새 {roleLabel} 초대 코드 생성</Text>
            </>
          )}
        </Pressable>

        {/* 코드 리스트 */}
        {invites.length > 0 ? (
          invites.map((invite) => (
            <View key={invite.id} style={styles.cardWrapper}>
              <InviteCodeCard
                invite={invite}
                targetRole={role}
                onDelete={() => handleDeleteInvite(invite, role)}
                onShowQR={() => setQrInvite(invite)}
              />
            </View>
          ))
        ) : (
          <Text style={[styles.emptyHint, { color: colors.textDisabled }]}>
            활성 초대 코드가 없습니다
          </Text>
        )}
      </View>
    );
  };

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.accentRedBg }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* 학생 쿼터 */}
        {studentQuota && (
          <QuotaIndicator label="학생" used={studentQuota.used} limit={studentQuota.limit} />
        )}

        {/* 학생 초대 섹션 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{ORG_ROLE_LABELS.student} 초대</Text>
          {renderInviteSection('student')}
        </View>

        {/* 강사 초대 섹션 (owner만) */}
        {canInviteTeachers && (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{ORG_ROLE_LABELS.teacher} 초대</Text>
            {renderInviteSection('teacher')}
          </View>
        )}
      </ScrollView>

      {/* QR 모달 */}
      {qrInvite && (
        <InviteQRModal
          visible={!!qrInvite}
          code={qrInvite.code}
          className={qrInvite.classes?.name}
          onClose={() => setQrInvite(null)}
        />
      )}
    </>
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
  sectionContainer: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 12,
  },
  selectorContainer: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 8,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
