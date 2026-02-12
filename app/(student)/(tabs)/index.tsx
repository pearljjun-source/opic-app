import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getMyTeacher, ConnectedTeacher } from '@/services/connection';
import { getMyTopicsWithProgress } from '@/services/topics';
import { TopicCard } from '@/components/student/TopicCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { getUserMessage } from '@/lib/errors';
import type { StudentTopicWithProgress } from '@/lib/types';

export default function StudentDashboard() {
  const [teacher, setTeacher] = useState<ConnectedTeacher | null>(null);
  const [topics, setTopics] = useState<StudentTopicWithProgress[]>([]);
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

    // 연결된 경우 토픽 목록 조회
    if (teacherData) {
      const { data: topicsData, error: topicsError } = await getMyTopicsWithProgress();
      if (!topicsError && topicsData) {
        setTopics(topicsData);
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>불러오는 중...</Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.ERROR} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  // 강사와 연결되지 않은 상태
  if (!teacher) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="people-outline"
          title="강사와 연결되지 않았습니다"
          description="강사에게 받은 초대 코드를 입력하여 연결하세요"
          actionLabel="초대 코드 입력"
          onAction={() => router.push('/(student)/connect')}
        />
      </View>
    );
  }

  // 연결됨 - 토픽 카드 표시
  return (
    <View style={styles.container}>
      {/* 강사 정보 카드 */}
      <View style={styles.teacherCard}>
        <View style={styles.teacherAvatar}>
          <Text style={styles.teacherInitial}>
            {teacher.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.teacherInfo}>
          <Text style={styles.teacherLabel}>담당 강사</Text>
          <Text style={styles.teacherName}>{teacher.name}</Text>
        </View>
        <Ionicons name="checkmark-circle" size={24} color={COLORS.SECONDARY} />
      </View>

      {/* 토픽 목록 */}
      <Text style={styles.sectionTitle}>내 토픽</Text>

      {topics.length === 0 ? (
        <View style={styles.emptyTopics}>
          <Ionicons name="book-outline" size={48} color={COLORS.GRAY_300} />
          <Text style={styles.emptyTitle}>배정된 토픽이 없습니다</Text>
          <Text style={styles.emptyHint}>
            강사님이 토픽을 배정하면{'\n'}여기에 표시됩니다
          </Text>
        </View>
      ) : (
        <FlatList
          data={topics}
          keyExtractor={(item) => item.topic_id}
          renderItem={({ item }) => (
            <TopicCard topic={item} onPress={() => handleTopicPress(item)} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  teacherAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teacherInitial: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.WHITE,
  },
  teacherInfo: {
    flex: 1,
  },
  teacherLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyTopics: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
});
