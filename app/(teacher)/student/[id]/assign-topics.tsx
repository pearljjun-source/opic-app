import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { TOPIC_CATEGORY_LABELS } from '@/lib/constants';
import { getTopics, type TopicListItem } from '@/services/scripts';
import { setStudentTopics, getStudentTopicsWithProgress } from '@/services/topics';
import { getUserMessage } from '@/lib/errors';
import type { TopicCategory } from '@/lib/types';
import { useThemeColors } from '@/hooks/useTheme';

export default function AssignTopicsScreen() {
  const colors = useThemeColors();
  const { id: studentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [allTopics, setAllTopics] = useState<TopicListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 전체 토픽 + 기존 배정 토픽 로드
  useEffect(() => {
    const load = async () => {
      if (!studentId) return;
      setIsLoading(true);

      const [topicsResult, assignedResult] = await Promise.all([
        getTopics(),
        getStudentTopicsWithProgress(studentId),
      ]);

      if (topicsResult.error) {
        setError(getUserMessage(topicsResult.error));
      } else {
        setAllTopics(topicsResult.data || []);
      }

      if (assignedResult.data) {
        setSelectedIds(new Set(assignedResult.data.map((t) => t.topic_id)));
      }

      setIsLoading(false);
    };

    load();
  }, [studentId]);

  // 카테고리별 그룹핑
  const groupedTopics = useMemo(() => {
    const groups: { category: TopicCategory; label: string; topics: TopicListItem[] }[] = [];
    const categoryOrder: TopicCategory[] = ['survey', 'unexpected'];

    for (const cat of categoryOrder) {
      const filtered = allTopics.filter((t) => t.category === cat);
      if (filtered.length > 0) {
        groups.push({
          category: cat,
          label: TOPIC_CATEGORY_LABELS[cat],
          topics: filtered,
        });
      }
    }

    return groups;
  }, [allTopics]);

  const toggleTopic = useCallback((topicId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!studentId) return;

    if (selectedIds.size === 0) {
      Alert.alert('알림', '최소 1개 이상의 토픽을 선택해주세요.');
      return;
    }

    setIsSaving(true);
    const { error: saveError } = await setStudentTopics(
      studentId,
      Array.from(selectedIds),
    );

    if (saveError) {
      Alert.alert('오류', getUserMessage(saveError));
      setIsSaving(false);
      return;
    }

    router.back();
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
    <>
      <Stack.Screen options={{ title: '토픽 배정', headerBackTitle: '뒤로' }} />

      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          학생에게 배정할 토픽을 선택하세요 ({selectedIds.size}개 선택)
        </Text>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {groupedTopics.map((group) => (
            <View key={group.category} style={styles.categorySection}>
              <Text style={[styles.categoryTitle, { color: colors.textPrimary }]}>{group.label} ({group.topics.length})</Text>
              <View style={styles.topicGrid}>
                {group.topics.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.topicCard,
                        { backgroundColor: colors.surface, shadowColor: '#000000' },
                        isSelected && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                      ]}
                      onPress={() => toggleTopic(item.id)}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          { backgroundColor: colors.primaryLight },
                          isSelected && { backgroundColor: colors.primary },
                        ]}
                      >
                        <Ionicons
                          name={
                            (item.icon as keyof typeof Ionicons.glyphMap) ||
                            'document-text-outline'
                          }
                          size={20}
                          color={isSelected ? '#FFFFFF' : colors.primary}
                        />
                      </View>
                      <Text
                        style={[
                          styles.topicName,
                          { color: colors.textPrimary },
                          isSelected && { color: colors.primaryDark, fontFamily: 'Pretendard-SemiBold' },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name_ko}
                      </Text>
                      {isSelected && (
                        <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary, shadowColor: '#000000' }, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>저장하기</Text>
          )}
        </TouchableOpacity>
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
  subtitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 16,
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
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicCard: {
    width: '31%',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  topicName: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
  },
});
