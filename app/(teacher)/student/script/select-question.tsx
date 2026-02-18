import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';

import { getQuestionsByTopic, QuestionListItem } from '@/services/scripts';
import { getUserMessage } from '@/lib/errors';
import { useThemeColors } from '@/hooks/useTheme';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  describe: '묘사/설명',
  routine: '루틴',
  experience: '과거 경험',
  comparison: '비교',
  roleplay: '롤플레이',
  advanced: '어드밴스',
};

export default function SelectQuestionScreen() {
  const colors = useThemeColors();
  const { topicId, studentId } = useLocalSearchParams<{
    topicId: string;
    studentId: string;
  }>();

  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQuestions = async () => {
      if (!topicId) return;

      setIsLoading(true);
      const { data, error: fetchError } = await getQuestionsByTopic(topicId);

      if (fetchError) {
        setError(getUserMessage(fetchError));
      } else {
        setQuestions(data || []);
        setError(null);
      }
      setIsLoading(false);
    };

    loadQuestions();
  }, [topicId]);

  const handleSelectQuestion = (questionId: string) => {
    router.push({
      pathname: '/(teacher)/student/script/new',
      params: { questionId, studentId },
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>질문 불러오는 중...</Text>
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

  if (questions.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>이 토픽에 등록된 질문이 없습니다</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>다른 토픽 선택</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>질문 선택</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>스크립트를 작성할 질문을 선택하세요</Text>

      <FlatList
        data={questions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.questionCard,
              { backgroundColor: colors.surface, shadowColor: '#000000' },
              pressed && styles.questionCardPressed,
            ]}
            onPress={() => handleSelectQuestion(item.id)}
          >
            <View style={styles.questionHeader}>
              <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                  {QUESTION_TYPE_LABELS[item.question_type] || item.question_type}
                </Text>
              </View>
              <View style={[styles.difficultyBadge, { backgroundColor: colors.borderLight }]}>
                <Text style={[styles.difficultyText, { color: colors.textSecondary }]}>Lv.{item.difficulty}</Text>
              </View>
            </View>
            <Text style={[styles.questionText, { color: colors.textPrimary }]}>{item.question_text}</Text>
            {item.hint_ko && (
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>{item.hint_ko}</Text>
            )}
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
  title: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
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
  emptyText: {
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
  questionCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  questionCardPressed: {
    opacity: 0.7,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  difficultyText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  hintText: {
    marginTop: 8,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
