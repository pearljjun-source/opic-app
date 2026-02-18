import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getMyTeacher, ConnectedTeacher } from '@/services/connection';
import { getMyTopicsWithProgress } from '@/services/topics';
import { getMyPracticeStats, getMyStreak } from '@/services/practices';
import { TopicCard } from '@/components/student/TopicCard';
import { CompactStatsStrip } from '@/components/student/CompactStatsStrip';
import { EmptyState } from '@/components/ui/EmptyState';
import { getUserMessage } from '@/lib/errors';
import type { StudentTopicWithProgress, StudentPracticeStats } from '@/lib/types';

export default function StudentDashboard() {
  const colors = useThemeColors();
  const [teacher, setTeacher] = useState<ConnectedTeacher | null>(null);
  const [topics, setTopics] = useState<StudentTopicWithProgress[]>([]);
  const [practiceStats, setPracticeStats] = useState<StudentPracticeStats | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // 강사 연결 확인
    const { data: teacherData, error: teacherError } = await getMyTeacher();

    if (teacherError) {
      setError(getUserMessage(teacherError));
      return;
    }

    setTeacher(teacherData);

    // 연결된 경우 병렬 데이터 조회
    if (teacherData) {
      const [topicsResult, statsResult, streakResult] = await Promise.all([
        getMyTopicsWithProgress(),
        getMyPracticeStats(),
        getMyStreak(),
      ]);

      if (!topicsResult.error && topicsResult.data) {
        setTopics(topicsResult.data);
      }

      if (!statsResult.error && statsResult.data) {
        setPracticeStats(statsResult.data);
      }

      if (!streakResult.error && streakResult.data) {
        setCurrentStreak(streakResult.data.current_streak);
      }
    }

    setError(null);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchData();
      setIsLoading(false);
    };
    loadData();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  const handleTopicPress = (topic: StudentTopicWithProgress) => {
    router.push({
      pathname: '/(student)/topic/[topicId]' as any,
      params: { topicId: topic.topic_id, topicName: topic.topic_name_ko },
    });
  };

  // 로딩 중
  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>불러오는 중...</Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
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

        {/* 컴팩트 통계 스트립 (탭하면 상세 펼침) */}
        {practiceStats && (
          <CompactStatsStrip stats={practiceStats} currentStreak={currentStreak} />
        )}

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
