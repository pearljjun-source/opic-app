import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getMyPractices } from '@/services/practices';
import { getUserMessage } from '@/lib/errors';

interface PracticeItem {
  id: string;
  score: number | null;
  reproduction_rate: number | null;
  duration: number | null;
  created_at: string;
  question_text: string;
  topic_name_ko: string;
}

export default function HistoryScreen() {
  const [practices, setPractices] = useState<PracticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPractices = useCallback(async () => {
    const { data, error: fetchError } = await getMyPractices();

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setPractices(data || []);
      setError(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadPractices();
      setIsLoading(false);
    };
    init();
  }, [loadPractices]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPractices();
    setIsRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.ERROR} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : practices.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={48} color={COLORS.GRAY_300} />
          <Text style={styles.emptyText}>연습 기록이 없습니다.</Text>
          <Text style={styles.emptyHint}>스크립트에서 연습을 시작해보세요!</Text>
        </View>
      ) : (
        <FlatList
          data={practices}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.practiceCard}
              onPress={() =>
                router.push({
                  pathname: '/(student)/script/practice/[practiceId]',
                  params: { practiceId: item.id },
                })
              }
            >
              <View style={styles.cardHeader}>
                <View style={styles.topicBadge}>
                  <Text style={styles.topicBadgeText}>{item.topic_name_ko}</Text>
                </View>
                <Text style={styles.date}>{formatDate(item.created_at)}</Text>
              </View>

              <Text style={styles.questionText} numberOfLines={2}>
                {item.question_text}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>점수</Text>
                  <Text style={[styles.statValue, item.score != null && item.score >= 70 && { color: COLORS.SECONDARY }]}>
                    {item.score ?? '-'}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>재현율</Text>
                  <Text style={styles.statValue}>
                    {item.reproduction_rate != null ? `${item.reproduction_rate}%` : '-'}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>녹음</Text>
                  <Text style={styles.statValue}>{formatDuration(item.duration)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.GRAY_400} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.ERROR,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
  },
  retryButtonText: {
    color: COLORS.WHITE,
    fontFamily: 'Pretendard-SemiBold',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
  },
  emptyHint: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.GRAY_400,
  },
  practiceCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicBadge: {
    backgroundColor: COLORS.PRIMARY + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  topicBadgeText: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
  },
  date: {
    fontSize: 12,
    color: COLORS.GRAY_400,
  },
  questionText: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_100,
    paddingTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.GRAY_400,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.TEXT_PRIMARY,
  },
});
