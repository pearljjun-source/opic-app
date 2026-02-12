import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getTopics, type TopicListItem } from '@/services/scripts';
import { setStudentTopics, getStudentTopicsWithProgress } from '@/services/topics';
import { getUserMessage } from '@/lib/errors';

export default function AssignTopicsScreen() {
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>토픽 불러오는 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '토픽 배정', headerBackTitle: '뒤로' }} />

      <View style={styles.container}>
        <Text style={styles.subtitle}>
          학생에게 배정할 토픽을 선택하세요 ({selectedIds.size}개 선택)
        </Text>

        <FlatList
          data={allTopics}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <Pressable
                style={[styles.topicCard, isSelected && styles.topicCardSelected]}
                onPress={() => toggleTopic(item.id)}
              >
                <View
                  style={[
                    styles.iconContainer,
                    isSelected && styles.iconContainerSelected,
                  ]}
                >
                  <Ionicons
                    name={
                      (item.icon as keyof typeof Ionicons.glyphMap) ||
                      'document-text-outline'
                    }
                    size={20}
                    color={isSelected ? COLORS.WHITE : COLORS.PRIMARY}
                  />
                </View>
                <Text
                  style={[
                    styles.topicName,
                    isSelected && styles.topicNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {item.name_ko}
                </Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color={COLORS.WHITE} />
                  </View>
                )}
              </Pressable>
            );
          }}
          contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          ListFooterComponentStyle={{ flex: 1, justifyContent: 'flex-end' }}
          ListFooterComponent={
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.saveButtonText}>저장하기</Text>
              )}
            </TouchableOpacity>
          }
        />
      </View>
    </>
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
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
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
  row: {
    justifyContent: 'space-between',
  },
  listContent: {
    paddingBottom: 16,
  },
  topicCard: {
    width: '31%',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  topicCardSelected: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconContainerSelected: {
    backgroundColor: COLORS.PRIMARY,
  },
  topicName: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  topicNameSelected: {
    color: COLORS.PRIMARY_DARK,
    fontFamily: 'Pretendard-SemiBold',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 12,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: COLORS.BLACK,
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
    color: COLORS.WHITE,
  },
});
