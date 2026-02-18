import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { TOPIC_CATEGORY_LABELS } from '@/lib/constants';
import { getTopics, TopicListItem } from '@/services/scripts';
import { getStudentTopicsWithProgress } from '@/services/topics';
import { getUserMessage } from '@/lib/errors';
import type { TopicCategory } from '@/lib/types';
import { useThemeColors } from '@/hooks/useTheme';

export default function SelectTopicScreen() {
  const colors = useThemeColors();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTopics = async () => {
      setIsLoading(true);

      if (studentId) {
        // 배정된 토픽만 표시
        const { data, error: fetchError } = await getStudentTopicsWithProgress(studentId);
        if (fetchError) {
          setError(getUserMessage(fetchError));
        } else {
          // StudentTopicWithProgress → TopicListItem 변환
          setTopics(
            (data || []).map((t) => ({
              id: t.topic_id,
              name_ko: t.topic_name_ko,
              name_en: t.topic_name_en,
              icon: t.topic_icon,
              description: null,
              category: t.topic_category,
            })),
          );
          setError(null);
        }
      } else {
        // 폴백: 전체 토픽
        const { data, error: fetchError } = await getTopics();
        if (fetchError) {
          setError(getUserMessage(fetchError));
        } else {
          setTopics(data || []);
          setError(null);
        }
      }

      setIsLoading(false);
    };

    loadTopics();
  }, [studentId]);

  // 카테고리별 그룹핑
  const groupedTopics = useMemo(() => {
    const groups: { category: TopicCategory; label: string; topics: TopicListItem[] }[] = [];
    const categoryOrder: TopicCategory[] = ['survey', 'unexpected'];

    for (const cat of categoryOrder) {
      const filtered = topics.filter((t) => t.category === cat);
      if (filtered.length > 0) {
        groups.push({
          category: cat,
          label: TOPIC_CATEGORY_LABELS[cat],
          topics: filtered,
        });
      }
    }

    return groups;
  }, [topics]);

  const handleSelectTopic = (topicId: string) => {
    router.push({
      pathname: '/(teacher)/student/script/select-question',
      params: { topicId, studentId },
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>토픽 불러오는 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {groupedTopics.map((group) => (
          <View key={group.category} style={styles.categorySection}>
            <Text style={[styles.categoryTitle, { color: colors.textPrimary }]}>{group.label}</Text>
            {group.topics.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.topicCard,
                  { backgroundColor: colors.surface, shadowColor: '#000000' },
                  pressed ? styles.topicCardPressed : null,
                ]}
                onPress={() => handleSelectTopic(item.id)}
              >
                <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons
                    name={(item.icon as keyof typeof Ionicons.glyphMap) || 'document-text-outline'}
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.topicInfo}>
                  <Text style={[styles.topicName, { color: colors.textPrimary }]}>{item.name_ko}</Text>
                  <Text style={[styles.topicNameEn, { color: colors.textSecondary }]}>{item.name_en}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
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
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 16,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 10,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  topicCardPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  topicInfo: {
    flex: 1,
  },
  topicName: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 2,
  },
  topicNameEn: {
    fontSize: 13,
  },
});
