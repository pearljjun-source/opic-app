import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { alert as xAlert, confirm as xConfirm } from '@/lib/alert';
import type {
  StudentDetailInfo,
  StudentDetailStats,
  StudentScriptListItem,
  StudentPracticeListItem,
  StudentTopicWithProgress,
  ExamSessionListItem,
  OpicGrade,
} from '@/lib/types';
import {
  getStudentDetail,
  getStudentScripts,
  getStudentPractices,
  disconnectStudent,
} from '@/services/students';
import { getStudentTopicsWithProgress } from '@/services/topics';
import { StudentInfoCard } from '@/components/teacher/StudentInfoCard';
import { StudentNotes } from '@/components/teacher/StudentNotes';
import { ScriptListItem } from '@/components/teacher/ScriptListItem';
import { PracticeListItem } from '@/components/teacher/PracticeListItem';
import { TopicProgressCard } from '@/components/teacher/TopicProgressCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { EXAM_TYPE_LABELS } from '@/lib/constants';
import { getStudentExamSessions } from '@/services/exams';
import { getUserMessage } from '@/lib/errors';
import { SkeletonDetail } from '@/components/ui/Loading';
import { useAuth } from '@/hooks/useAuth';
import { canManageOrg } from '@/lib/permissions';
import { removeOrgMember } from '@/services/organizations';
import { useThemeColors } from '@/hooks/useTheme';
import { on } from '@/lib/events';

type TabType = 'topics' | 'scripts' | 'practices' | 'exams';

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentOrg, orgRole } = useAuth();
  const colors = useThemeColors();
  const isOwner = canManageOrg(orgRole);

  // State
  const [activeTab, setActiveTab] = useState<TabType>('topics');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNotesModalVisible, setIsNotesModalVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Data
  const [student, setStudent] = useState<StudentDetailInfo | null>(null);
  const [stats, setStats] = useState<StudentDetailStats | null>(null);
  const [topics, setTopics] = useState<StudentTopicWithProgress[]>([]);
  const [scripts, setScripts] = useState<StudentScriptListItem[]>([]);
  const [practices, setPractices] = useState<StudentPracticeListItem[]>([]);
  const [exams, setExams] = useState<ExamSessionListItem[]>([]);

  // Fetch student detail
  const fetchStudentDetail = useCallback(async () => {
    if (!id) return;

    const { data, error: fetchError } = await getStudentDetail(id);

    if (fetchError) {
      setError(getUserMessage(fetchError));
      return;
    }

    if (data?.success && data.student && data.stats) {
      setStudent(data.student);
      setStats(data.stats);
      setError(null);
    } else {
      setError(data?.error || '학생 정보를 불러올 수 없습니다.');
    }
  }, [id]);

  // Fetch topics with progress
  const fetchTopics = useCallback(async () => {
    if (!id) return;

    const { data, error: fetchError } = await getStudentTopicsWithProgress(id);

    if (fetchError) {
      if (__DEV__) console.warn('[AppError] Error fetching topics:', fetchError);
      return;
    }

    setTopics(data || []);
  }, [id]);

  // Fetch scripts
  const fetchScripts = useCallback(async () => {
    if (!id) return;

    const { data, error: fetchError } = await getStudentScripts(id);

    if (fetchError) {
      if (__DEV__) console.warn('[AppError] Error fetching scripts:', fetchError);
      return;
    }

    setScripts(data || []);
  }, [id]);

  // Fetch practices
  const fetchPractices = useCallback(async () => {
    if (!id) return;

    const { data, error: fetchError } = await getStudentPractices(id);

    if (fetchError) {
      if (__DEV__) console.warn('[AppError] Error fetching practices:', fetchError);
      return;
    }

    setPractices(data || []);
  }, [id]);

  // Fetch exams
  const fetchExams = useCallback(async () => {
    if (!id) return;

    const { data, error: fetchError } = await getStudentExamSessions(id);

    if (fetchError) {
      if (__DEV__) console.warn('[AppError] Error fetching exams:', fetchError);
      return;
    }

    setExams(data || []);
  }, [id]);

  // Initial load
  const isFirstMount = useRef(true);
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchStudentDetail(), fetchTopics(), fetchScripts(), fetchPractices(), fetchExams()]);
      setIsLoading(false);
    };

    loadData();
  }, [fetchStudentDetail, fetchTopics, fetchScripts, fetchPractices, fetchExams]);

  // 화면 포커스 시 데이터 재조회 (토픽 배정 등 자식 화면에서 돌아올 때)
  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      fetchTopics();
      fetchScripts();
      fetchPractices();
      fetchExams();
    }, [fetchTopics, fetchScripts, fetchPractices, fetchExams]),
  );

  // 이벤트 버스 구독 (웹에서 useFocusEffect가 작동하지 않는 경우 대비)
  useEffect(() => {
    const offScript = on('script-changed', fetchScripts);
    const offTopics = on('topics-changed', fetchTopics);
    const offPractice = on('practice-changed', fetchPractices);
    return () => { offScript(); offTopics(); offPractice(); };
  }, [fetchScripts, fetchTopics, fetchPractices]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStudentDetail(), fetchTopics(), fetchScripts(), fetchPractices(), fetchExams()]);
    setIsRefreshing(false);
  }, [fetchStudentDetail, fetchTopics, fetchScripts, fetchPractices, fetchExams]);

  // Navigation handlers
  const handleTopicPress = (topic: StudentTopicWithProgress) => {
    router.push({
      pathname: `/(teacher)/student/[id]/topic/[topicId]` as any,
      params: { id, topicId: topic.topic_id, topicName: topic.topic_name_ko },
    });
  };

  const handleAssignTopics = () => {
    router.push({
      pathname: `/(teacher)/student/[id]/assign-topics` as any,
      params: { id },
    });
  };

  const handleScriptPress = (script: StudentScriptListItem) => {
    router.push(`/(teacher)/student/script/${script.id}`);
  };

  const handlePracticePress = (practice: StudentPracticeListItem) => {
    router.push(`/(teacher)/student/${id}/practice/${practice.id}`);
  };

  const handleNewScript = () => {
    router.push({
      pathname: '/(teacher)/student/script/select-topic',
      params: { studentId: id },
    });
  };

  // 학생 관리 메뉴
  const handleMoreMenu = () => {
    setIsMenuVisible(true);
  };

  const handleDisconnect = () => {
    if (!id || !student) return;

    xConfirm(
      '나와의 연결 해제',
      `${student.name} 학생과의 연결을 해제하시겠습니까?\n\n• 내 반에서 자동 제외됩니다\n• 배정된 토픽이 해제됩니다\n• 다른 강사와의 연결은 유지됩니다`,
      async () => {
        const { error: disconnectError } = await disconnectStudent(id);
        if (disconnectError) {
          xAlert('오류', getUserMessage(disconnectError));
        } else {
          router.back();
        }
      },
      { confirmText: '연결 해제' },
    );
  };

  const handleRemoveFromOrg = () => {
    if (!id || !student || !currentOrg) return;

    xConfirm(
      '학원에서 제거',
      `${student.name} 학생을 학원에서 완전히 제거하시겠습니까?\n\n• 학원의 모든 강사와 연결이 해제됩니다\n• 모든 반에서 제외됩니다\n• 이 작업은 되돌릴 수 없습니다`,
      async () => {
        const result = await removeOrgMember(currentOrg.id, id);
        if (result.success) {
          router.back();
        } else {
          xAlert('오류', result.error || '학생 제거에 실패했습니다.');
        }
      },
      { confirmText: '제거' },
    );
  };

  // Render tab content (ScrollView + map: RecyclerView z-order 문제 방지)
  const renderTopics = () => {
    if (topics.length === 0) {
      return (
        <EmptyState
          icon="book-outline"
          title="배정된 토픽이 없어요"
          description="토픽을 배정하여 학생의 학습 주제를 설정하세요"
          actionLabel="토픽 배정"
          onAction={handleAssignTopics}
        />
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {topics.map((item) => (
            <TopicProgressCard key={item.topic_id} topic={item} onPress={() => handleTopicPress(item)} />
          ))}
        </ScrollView>
        <Pressable
          style={[styles.actionBar, { backgroundColor: colors.primary }]}
          android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
          onPress={handleAssignTopics}
        >
          <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionBarText}>토픽 배정</Text>
        </Pressable>
      </View>
    );
  };

  const renderScripts = () => {
    if (scripts.length === 0) {
      return (
        <EmptyState
          icon="document-text-outline"
          title="아직 스크립트가 없어요"
          description="새 스크립트를 작성하여 학생의 학습을 시작하세요"
          actionLabel="스크립트 작성"
          onAction={handleNewScript}
        />
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {scripts.map((item) => (
            <ScriptListItem key={item.id} script={item} onPress={() => handleScriptPress(item)} />
          ))}
        </ScrollView>
        <Pressable
          style={[styles.actionBar, { backgroundColor: colors.primary }]}
          android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
          onPress={handleNewScript}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.actionBarText}>스크립트 작성</Text>
        </Pressable>
      </View>
    );
  };

  const renderPractices = () => {
    if (practices.length === 0) {
      return (
        <EmptyState
          icon="mic-outline"
          title="아직 연습 기록이 없어요"
          description="학생이 스크립트로 연습을 시작하면 여기에 표시됩니다"
        />
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {practices.map((item) => (
          <PracticeListItem
            key={item.id}
            practice={item}
            onPress={() => handlePracticePress(item)}
          />
        ))}
      </ScrollView>
    );
  };

  const renderExams = () => {
    if (exams.length === 0) {
      return (
        <EmptyState
          icon="document-text-outline"
          title="아직 시험 기록이 없어요"
          description="학생이 모의고사나 레벨 테스트를 응시하면 여기에 표시됩니다"
        />
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {exams.map((exam) => (
          <View
            key={exam.id}
            style={[styles.examItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.examItemTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.examType, { color: colors.textPrimary }]}>
                  {EXAM_TYPE_LABELS[exam.exam_type]}
                </Text>
                <Text style={[styles.examDate, { color: colors.textSecondary }]}>
                  {new Date(exam.started_at).toLocaleDateString('ko-KR')}
                </Text>
              </View>
              {exam.estimated_grade ? (
                <View style={[styles.examGradeBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.examGradeText, { color: colors.primary }]}>{exam.estimated_grade}</Text>
                </View>
              ) : (
                <Text style={[styles.examStatusText, { color: colors.textDisabled }]}>
                  {exam.status === 'completed' ? '채점 중' : exam.status === 'abandoned' ? '포기' : '진행 중'}
                </Text>
              )}
            </View>
            {exam.overall_score != null && (
              <Text style={[styles.examScore, { color: colors.textSecondary }]}>
                종합 {exam.overall_score}점
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
        <SkeletonDetail />
      </View>
    );
  }

  // Error state
  if (error || !student || !stats) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error || '오류가 발생했습니다'}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: student.name,
          headerBackTitle: '뒤로',
          headerRight: () => (
            <Pressable
              onPress={handleMoreMenu}
              style={styles.headerButton}
              hitSlop={8}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={colors.textPrimary} />
            </Pressable>
          ),
        }}
      />

      {/* 메모 + 목표 등급 모달 */}
      <Modal
        visible={isNotesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsNotesModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>메모 / 목표 등급</Text>
            <Pressable onPress={() => setIsNotesModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <StudentNotes
            studentId={id!}
            initialNotes={stats.notes ?? null}
            initialTargetGrade={(stats.target_opic_grade as OpicGrade) ?? null}
            onSaved={() => {
              fetchStudentDetail();
              setIsNotesModalVisible(false);
            }}
          />
        </View>
      </Modal>

      {/* 학생 관리 바텀 시트 */}
      <Modal
        visible={isMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setIsMenuVisible(false)}
        >
          <Pressable style={[styles.menuSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.menuHandle, { backgroundColor: colors.gray300 }]} />
            <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>학생 관리</Text>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setIsMenuVisible(false);
                setIsNotesModalVisible(true);
              }}
            >
              <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
              <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>메모 / 목표 등급</Text>
            </Pressable>

            <View style={[styles.menuDivider, { backgroundColor: colors.borderLight }]} />

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setIsMenuVisible(false);
                handleDisconnect();
              }}
            >
              <Ionicons name="unlink-outline" size={20} color={colors.error} />
              <Text style={[styles.menuItemText, styles.menuItemDestructive, { color: colors.error }]}>나와의 연결 해제</Text>
            </Pressable>

            {isOwner && currentOrg && (
              <>
                <View style={[styles.menuDivider, { backgroundColor: colors.borderLight }]} />
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setIsMenuVisible(false);
                    handleRemoveFromOrg();
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                  <Text style={[styles.menuItemText, styles.menuItemDestructive, { color: colors.error }]}>학원에서 제거</Text>
                </Pressable>
              </>
            )}

            <Pressable
              style={[styles.menuCancelButton, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => setIsMenuVisible(false)}
            >
              <Text style={[styles.menuCancelText, { color: colors.textSecondary }]}>취소</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        {/* 학생 정보 카드 */}
        <StudentInfoCard student={student} stats={stats} />

        {/* 탭 네비게이션 */}
        <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
          <Pressable
            style={[styles.tab, activeTab === 'topics' && [styles.activeTab, { backgroundColor: colors.primary }]]}
            onPress={() => setActiveTab('topics')}
          >
            <Text
              style={[
                styles.tabText,
                { color: colors.textSecondary },
                activeTab === 'topics' && styles.activeTabText,
              ]}
            >
              주제 ({topics.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'scripts' && [styles.activeTab, { backgroundColor: colors.primary }]]}
            onPress={() => setActiveTab('scripts')}
          >
            <Text
              style={[
                styles.tabText,
                { color: colors.textSecondary },
                activeTab === 'scripts' && styles.activeTabText,
              ]}
            >
              스크립트 ({scripts.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'practices' && [styles.activeTab, { backgroundColor: colors.primary }]]}
            onPress={() => setActiveTab('practices')}
          >
            <Text
              style={[
                styles.tabText,
                { color: colors.textSecondary },
                activeTab === 'practices' && styles.activeTabText,
              ]}
            >
              연습 ({practices.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'exams' && [styles.activeTab, { backgroundColor: colors.primary }]]}
            onPress={() => setActiveTab('exams')}
          >
            <Text
              style={[
                styles.tabText,
                { color: colors.textSecondary },
                activeTab === 'exams' && styles.activeTabText,
              ]}
            >
              시험 ({exams.length})
            </Text>
          </Pressable>
        </View>

        {/* 탭 콘텐츠 */}
        <View style={styles.tabContent}>
          {activeTab === 'topics' && renderTopics()}
          {activeTab === 'scripts' && renderScripts()}
          {activeTab === 'practices' && renderPractices()}
          {activeTab === 'exams' && renderExams()}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabContent: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  actionBarPressed: {
    opacity: 0.8,
  },
  actionBarText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  headerButton: {
    padding: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  menuItemText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
  menuItemDestructive: {},
  menuDivider: {
    height: 1,
  },
  menuCancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  menuCancelText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  examItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  examItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examType: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  examDate: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  examGradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  examGradeText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
  },
  examStatusText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
  examScore: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginTop: 6,
  },
});
