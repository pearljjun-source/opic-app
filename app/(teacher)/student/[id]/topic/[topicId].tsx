import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import type { TopicQuestionWithScript } from '@/lib/types';
import { getTopicQuestionsWithScripts } from '@/services/topics';
import { getUserMessage } from '@/lib/errors';
import { useThemeColors } from '@/hooks/useTheme';

export default function TopicQuestionsScreen() {
  const colors = useThemeColors();
  const { id: studentId, topicId } = useLocalSearchParams<{
    id: string;
    topicId: string;
  }>();
  const router = useRouter();

  const [questions, setQuestions] = useState<TopicQuestionWithScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicName, setTopicName] = useState('');

  const fetchQuestions = useCallback(async () => {
    if (!studentId || !topicId) return;

    const { data, error: fetchError } = await getTopicQuestionsWithScripts(
      studentId,
      topicId,
    );

    if (fetchError) {
      setError(getUserMessage(fetchError));
      return;
    }

    setQuestions(data || []);
    setError(null);
  }, [studentId, topicId]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchQuestions();
      setIsLoading(false);
    };
    load();
  }, [fetchQuestions]);

  // 첫 질문에서 topic name 추출 (RPC에 포함되지 않으므로 param으로 전달)
  const { topicName: topicNameParam } = useLocalSearchParams<{
    topicName: string;
  }>();
  useEffect(() => {
    if (topicNameParam) setTopicName(topicNameParam);
  }, [topicNameParam]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchQuestions();
    setIsRefreshing(false);
  };

  const handleQuestionPress = (question: TopicQuestionWithScript) => {
    if (question.script_id) {
      // 스크립트가 있으면 수정 화면
      router.push(`/(teacher)/student/script/${question.script_id}`);
    } else {
      // 스크립트가 없으면 작성 화면
      router.push({
        pathname: '/(teacher)/student/script/new',
        params: { questionId: question.question_id, studentId },
      });
    }
  };

  const handleNewScript = () => {
    router.push({
      pathname: '/(teacher)/student/script/select-question',
      params: { topicId, studentId },
    });
  };

  const renderQuestion = ({ item }: { item: TopicQuestionWithScript }) => {
    const hasScript = !!item.script_id;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.questionCard,
          { backgroundColor: colors.surface, shadowColor: '#000000' },
          pressed && styles.questionCardPressed,
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
              <Ionicons
                name="document-text"
                size={12}
                color={colors.primary}
              />
              <Text style={[styles.scriptBadgeText, { color: colors.primary }]}>스크립트 있음</Text>
            </View>
            {item.practices_count > 0 && (
              <Text style={[styles.practiceInfo, { color: colors.gray400 }]}>
                연습 {item.practices_count}회
                {item.best_score != null && ` · 최고 ${item.best_score}점`}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.noScriptRow}>
            <Text style={[styles.noScriptText, { color: colors.gray400 }]}>스크립트 미작성</Text>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          </View>
        )}
      </Pressable>
    );
  };

  if (isLoading) {
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
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
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
          title: topicName || '질문 목록',
          headerBackTitle: '뒤로',
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        {/* 진행 상황 */}
        <View style={[styles.progressCard, { backgroundColor: colors.surface, shadowColor: '#000000' }]}>
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

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {questions.map((item) => (
            <View key={item.question_id}>
              {renderQuestion({ item })}
            </View>
          ))}
        </ScrollView>
        <Pressable
          style={[styles.actionBar, { backgroundColor: colors.primary }]}
          android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
          onPress={handleNewScript}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.actionBarText}>스크립트 작성</Text>
        </Pressable>
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
    paddingBottom: 16,
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
  noScriptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 18,
  },
  noScriptText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  actionBarPressed: {
    opacity: 0.8,
  },
  actionBarText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
});
