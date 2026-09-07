import { useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import type { TopicQuestionWithScript } from '@/lib/types';
import { getMyTopicQuestionsWithScripts } from '@/services/topics';
import { getUserMessage } from '@/lib/errors';
import { queryKeys, unwrap } from '@/lib/query';
import { showToast } from '@/lib/toast';
import { TEST_IDS } from '@/lib/testIds';

export default function StudentTopicQuestionsScreen() {
  const colors = useThemeColors();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const { topicName: topicNameParam } = useLocalSearchParams<{
    topicName: string;
  }>();
  const router = useRouter();

  const {
    data: questions = [],
    isPending,
    error,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.topics.questions(topicId ?? ''),
    queryFn: async () => (await unwrap(getMyTopicQuestionsWithScripts(topicId!))) ?? [],
    // 라우트 파라미터가 아직 안 붙은 첫 렌더에서는 조회하지 않는다.
    enabled: !!topicId,
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleQuestionPress = (question: TopicQuestionWithScript) => {
    if (question.script_id) {
      router.push(`/(student)/script/${question.script_id}` as any);
    } else {
      showToast('아직 강사님이 스크립트를 준비 중이에요', 'info');
    }
  };

  const renderQuestion = ({ item }: { item: TopicQuestionWithScript }) => {
    const hasScript = !!item.script_id;

    return (
      <Pressable
        testID={hasScript ? TEST_IDS.QUESTION_CARD_WITH_SCRIPT : undefined}
        style={({ pressed }) => [
          styles.questionCard,
          { backgroundColor: colors.surface, shadowColor: colors.shadowColor },
          pressed && styles.questionCardPressed,
          !hasScript && styles.questionCardDisabled,
        ]}
        onPress={() => handleQuestionPress(item)}
      >
        <View style={styles.questionHeader}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: hasScript ? colors.secondary : colors.gray300 },
            ]}
          />
          <Text style={[styles.questionText, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.question_text}
          </Text>
        </View>

        {item.hint_ko && (
          <Text style={[styles.hintText, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.hint_ko}
          </Text>
        )}

        {hasScript ? (
          <View style={styles.scriptInfo}>
            <View style={[styles.scriptBadge, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="document-text" size={12} color={colors.primary} />
              <Text style={[styles.scriptBadgeText, { color: colors.primary }]}>스크립트 준비됨</Text>
            </View>
            {item.practices_count > 0 ? (
              <Text style={[styles.practiceInfo, { color: colors.textDisabled }]}>
                연습 {item.practices_count}회
                {item.best_score != null && ` · 최고 ${item.best_score}점`}
              </Text>
            ) : (
              <Text style={[styles.practiceInfo, { color: colors.textDisabled }]}>아직 연습 없음</Text>
            )}
          </View>
        ) : (
          <View style={styles.scriptInfo}>
            <View style={[styles.scriptBadge, { backgroundColor: colors.borderLight }]}>
              <Ionicons name="lock-closed" size={12} color={colors.textDisabled} />
              <Text style={[styles.scriptBadgeText, { color: colors.textDisabled }]}>준비 중</Text>
            </View>
            <Text style={[styles.practiceInfo, { color: colors.textDisabled }]}>강사님이 준비 중이에요</Text>
          </View>
        )}
      </Pressable>
    );
  };

  // 캐시가 있으면 여기 오지 않는다 — 연습을 마치고 돌아올 때 깜빡이지 않는 이유다.
  if (isPending) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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

  const scriptsReady = questions.filter((q) => q.script_id).length;

  return (
    <>
      <Stack.Screen
        options={{
          title: topicNameParam || '질문 목록',
          headerBackTitle: '뒤로',
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        {/* 진행 상황 */}
        <View style={[styles.progressCard, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>스크립트 준비</Text>
          <Text style={[styles.progressValue, { color: colors.textPrimary }]}>
            {scriptsReady} / {questions.length}
          </Text>
          <View style={[styles.progressBarBg, { backgroundColor: colors.borderLight }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: colors.primary },
                {
                  width: `${
                    questions.length > 0
                      ? (scriptsReady / questions.length) * 100
                      : 0
                  }%`,
                },
              ]}
            />
          </View>
        </View>

        <FlatList
          data={questions}
          keyExtractor={(item) => item.question_id}
          renderItem={renderQuestion}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
          }
        />
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
  progressCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  listContent: {
    paddingBottom: 24,
  },
  questionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  questionCardPressed: {
    opacity: 0.7,
  },
  questionCardDisabled: {
    opacity: 0.6,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 10,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    lineHeight: 20,
  },
  hintText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    marginLeft: 18,
    marginBottom: 8,
  },
  scriptInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 18,
  },
  scriptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scriptBadgeText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
  practiceInfo: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
  },
});
