import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';

import { COLORS } from '@/lib/constants';
import { getQuestionsByTopic, QuestionListItem } from '@/services/scripts';
import { getUserMessage } from '@/lib/errors';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  describe: '묘사/설명',
  routine: '루틴',
  experience: '과거 경험',
  comparison: '비교',
  roleplay: '롤플레이',
  advanced: '어드밴스',
};

export default function SelectQuestionScreen() {
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>질문 불러오는 중...</Text>
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

  if (questions.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>이 토픽에 등록된 질문이 없습니다</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>다른 토픽 선택</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>질문 선택</Text>
      <Text style={styles.subtitle}>스크립트를 작성할 질문을 선택하세요</Text>

      <FlatList
        data={questions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.questionCard,
              pressed && styles.questionCardPressed,
            ]}
            onPress={() => handleSelectQuestion(item.id)}
          >
            <View style={styles.questionHeader}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {QUESTION_TYPE_LABELS[item.question_type] || item.question_type}
                </Text>
              </View>
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>Lv.{item.difficulty}</Text>
              </View>
            </View>
            <Text style={styles.questionText}>{item.question_text}</Text>
            {item.hint_ko && (
              <Text style={styles.hintText}>{item.hint_ko}</Text>
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
  title: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 24,
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
  emptyText: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
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
  listContent: {
    paddingBottom: 16,
  },
  questionCard: {
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: COLORS.BLACK,
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
    backgroundColor: COLORS.PRIMARY + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.PRIMARY,
  },
  difficultyBadge: {
    backgroundColor: COLORS.GRAY_100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  difficultyText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_PRIMARY,
  },
  hintText: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic',
  },
});
