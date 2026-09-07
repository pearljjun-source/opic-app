import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getMyTeacher, ConnectedTeacher } from '@/services/connection';
import { getMyTopicsWithProgress } from '@/services/topics';
import { getMyPracticeStats, getMyStreak, getDailyProgress, setDailyGoal, getWeakAreas, DailyProgress, WeakAreas } from '@/services/practices';
import { TopicCard } from '@/components/student/TopicCard';
import { CompactStatsStrip } from '@/components/student/CompactStatsStrip';
import { DailyGoalCard } from '@/components/student/DailyGoalCard';
import { WeakAreasCard } from '@/components/student/WeakAreasCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDashboard } from '@/components/ui/Loading';
import { getUserMessage } from '@/lib/errors';
import { queryKeys, unwrap } from '@/lib/query';
import type { StudentTopicWithProgress, StudentPracticeStats } from '@/lib/types';

export default function StudentDashboard() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();

  // 강사 연결 여부가 나머지 전부를 좌우한다. 이것만 실패하면 화면을 못 그린다.
  const teacherQuery = useQuery({
    queryKey: queryKeys.connection.myTeacher(),
    queryFn: () => unwrap(getMyTeacher()),
  });
  const teacher: ConnectedTeacher | null = teacherQuery.data ?? null;

  // 강사가 붙어야 의미가 있는 조회들. enabled 로 묶어두면 미연결 학생에게
  // 쓸데없는 요청이 나가지 않는다.
  const enabled = !!teacher;

  const topicsQuery = useQuery({
    queryKey: queryKeys.topics.mine(),
    queryFn: async () => (await unwrap(getMyTopicsWithProgress())) ?? [],
    enabled,
  });
  const statsQuery = useQuery({
    queryKey: queryKeys.practices.stats(),
    queryFn: () => unwrap(getMyPracticeStats()),
    enabled,
  });
  const streakQuery = useQuery({
    queryKey: queryKeys.practices.streak(),
    queryFn: () => unwrap(getMyStreak()),
    enabled,
  });
  const dailyQuery = useQuery({
    queryKey: queryKeys.practices.dailyProgress(),
    queryFn: () => unwrap(getDailyProgress()),
    enabled,
  });
  const weakQuery = useQuery({
    queryKey: queryKeys.practices.weakAreas(),
    queryFn: () => unwrap(getWeakAreas()),
    enabled,
  });

  const topics: StudentTopicWithProgress[] = topicsQuery.data ?? [];
  const practiceStats: StudentPracticeStats | null = statsQuery.data ?? null;
  const currentStreak = streakQuery.data?.current_streak ?? 0;
  const dailyProgress: DailyProgress | null = dailyQuery.data ?? null;
  const weakAreas: WeakAreas | null = weakQuery.data ?? null;

  // 부수 조회가 실패해도 화면은 그린다 — 예전 코드도 에러를 무시했다.
  // 강사 조회만은 실패하면 보여줄 게 없으므로 에러 화면으로 간다.
  const error = teacherQuery.error;
  const isPending = teacherQuery.isPending;
  const isRefreshing =
    teacherQuery.isRefetching ||
    topicsQuery.isRefetching ||
    statsQuery.isRefetching ||
    streakQuery.isRefetching ||
    dailyQuery.isRefetching ||
    weakQuery.isRefetching;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.connection.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.topics.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.practices.all });
  };

  const handleTopicPress = (topic: StudentTopicWithProgress) => {
    router.push({
      pathname: '/(student)/topic/[topicId]' as any,
      params: { topicId: topic.topic_id, topicName: topic.topic_name_ko },
    });
  };

  // 캐시가 있으면 여기 오지 않는다. 처음 열 때만 스켈레톤이다.
  if (isPending) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <SkeletonDashboard />
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{getUserMessage(error)}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  // 강사와 연결되지 않은 상태
  if (!teacher) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <EmptyState
          icon="people-outline"
          title="아직 학원에 소속되지 않았습니다"
          description="초대 코드를 입력하여 시작하세요"
          actionLabel="초대 코드 입력"
          onAction={() => router.push('/(student)/connect')}
        />
      </View>
    );
  }

  // 연결됨 - 대시보드 표시
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 강사 정보 카드 */}
        <View style={[styles.teacherCard, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}>
          <View style={[styles.teacherAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.teacherInitial}>
              {teacher.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.teacherInfo}>
            <Text style={[styles.teacherLabel, { color: colors.textSecondary }]}>담당 강사</Text>
            <Text style={[styles.teacherName, { color: colors.textPrimary }]}>{teacher.name}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
        </View>

        {/* 일일 목표 & 스트릭 */}
        {dailyProgress && (
          <DailyGoalCard
            progress={dailyProgress}
            currentStreak={currentStreak}
            onChangeGoal={async (newTarget) => {
              const { error: goalError } = await setDailyGoal(newTarget);
              if (!goalError) {
                // 서버 재조회를 기다리지 않고 캐시를 바로 고친다.
                queryClient.setQueryData<DailyProgress | null>(
                  queryKeys.practices.dailyProgress(),
                  (prev) =>
                    prev
                      ? { ...prev, daily_target: newTarget, completed: prev.today_count >= newTarget }
                      : prev,
                );
              }
            }}
          />
        )}

        {/* 컴팩트 통계 스트립 (탭하면 상세 펼침) */}
        {practiceStats && (
          <CompactStatsStrip stats={practiceStats} currentStreak={currentStreak} />
        )}

        {/* 약점 토픽 추천 */}
        {weakAreas && <WeakAreasCard weakAreas={weakAreas} />}

        {/* 핵심 표현 바로가기 */}
        <Pressable
          style={[styles.expressionLink, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}
          onPress={() => router.push('/(student)/expressions' as any)}
        >
          <View style={[styles.expressionIcon, { backgroundColor: '#6366F1' + '15' }]}>
            <Ionicons name="book-outline" size={20} color="#6366F1" />
          </View>
          <View style={styles.expressionInfo}>
            <Text style={[styles.expressionTitle, { color: colors.textPrimary }]}>OPIc 핵심 표현</Text>
            <Text style={[styles.expressionDesc, { color: colors.textSecondary }]}>상황별 필수 표현 학습</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
        </Pressable>

        {/* 토픽 목록 */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>내 토픽</Text>

        {topics.length === 0 ? (
          <View style={styles.emptyTopics}>
            <Ionicons name="book-outline" size={48} color={colors.gray300} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>배정된 토픽이 없습니다</Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
              강사님이 토픽을 배정하면{'\n'}여기에 표시됩니다
            </Text>
          </View>
        ) : (
          <View style={styles.topicsContainer}>
            {topics.map((item) => (
              <TopicCard key={item.topic_id} topic={item} onPress={() => handleTopicPress(item)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 24,
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
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  teacherAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teacherInitial: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
  },
  teacherInfo: {
    flex: 1,
  },
  teacherLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  expressionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  expressionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expressionInfo: { flex: 1 },
  expressionTitle: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },
  expressionDesc: { fontSize: 12, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  topicsContainer: {
    paddingHorizontal: 16,
  },
  emptyTopics: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
