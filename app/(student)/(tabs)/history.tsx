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

import { useThemeColors } from '@/hooks/useTheme';
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
  const colors = useThemeColors();
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : practices.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={48} color={colors.gray300} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>연습 기록이 없습니다.</Text>
          <Text style={[styles.emptyHint, { color: colors.textDisabled }]}>스크립트에서 연습을 시작해보세요!</Text>
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
              style={[styles.practiceCard, { backgroundColor: colors.surface }]}
              onPress={() =>
                router.push({
                  pathname: '/(student)/script/practice/[practiceId]',
                  params: { practiceId: item.id },
                })
              }
            >
              <View style={styles.cardHeader}>
                <View style={[styles.topicBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.topicBadgeText, { color: colors.primary }]}>{item.topic_name_ko}</Text>
                </View>
                <Text style={[styles.date, { color: colors.textDisabled }]}>{formatDate(item.created_at)}</Text>
              </View>

              <Text style={[styles.questionText, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.question_text}
              </Text>

              <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textDisabled }]}>점수</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }, item.score != null && item.score >= 70 && { color: colors.secondary }]}>
                    {item.score ?? '-'}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textDisabled }]}>재현율</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {item.reproduction_rate != null ? `${item.reproduction_rate}%` : '-'}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textDisabled }]}>녹음</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatDuration(item.duration)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textDisabled} />
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
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Pretendard-SemiBold',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyHint: {
    marginTop: 4,
    fontSize: 14,
  },
  practiceCard: {
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  topicBadgeText: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
  },
  date: {
    fontSize: 12,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
  },
});
