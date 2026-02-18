import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getPracticeResult, PracticeResult } from '@/services/practices';
import { getUserMessage } from '@/lib/errors';
import { diffScript } from '@/lib/diff';
import FeedbackSection from '@/components/student/FeedbackSection';

export default function ResultScreen() {
  const colors = useThemeColors();
  const { id, practiceId } = useLocalSearchParams<{ id: string; practiceId: string }>();

  const [result, setResult] = useState<PracticeResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scriptDiff = useMemo(
    () => result ? diffScript(result.script_content, result.transcription || '') : [],
    [result],
  );

  useEffect(() => {
    const loadResult = async () => {
      if (!practiceId) {
        setError('연습 기록을 찾을 수 없습니다.');
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await getPracticeResult(practiceId);

      if (fetchError) {
        setError(getUserMessage(fetchError));
      } else if (data) {
        setResult(data);
      }

      setIsLoading(false);
    };

    loadResult();
  }, [practiceId]);

  // 로딩 중
  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>결과 불러오는 중...</Text>
      </View>
    );
  }

  // 에러 상태
  if (error || !result) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error || '결과를 불러올 수 없습니다.'}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  const feedback = result.feedback;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surfaceSecondary }]} contentContainerStyle={styles.content}>
      {/* 점수 섹션 */}
      <View style={styles.scoreSection}>
        <View style={[styles.scoreBox, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>점수</Text>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>{result.score ?? '-'}</Text>
        </View>
        <View style={[styles.scoreBox, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>재현율</Text>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>
            {result.reproduction_rate ? `${result.reproduction_rate}%` : '-'}
          </Text>
        </View>
      </View>

      {/* 질문 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>질문</Text>
        <View style={[styles.questionBox, { backgroundColor: colors.primary + '10', borderLeftColor: colors.primary }]}>
          <Text style={[styles.questionText, { color: colors.textPrimary }]}>{result.question_text}</Text>
        </View>
      </View>

      {/* 내 답변 (STT 결과) */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>내 답변 (음성 인식 결과)</Text>
        <View style={[styles.transcriptionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.transcriptionText, { color: colors.textPrimary }]}>
            {result.transcription || '음성 인식 결과가 없습니다.'}
          </Text>
        </View>
      </View>

      {/* 원본 스크립트 (빠뜨린 단어 빨간색 하이라이트) */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>원본 스크립트</Text>
        <View style={[styles.scriptBox, { backgroundColor: colors.borderLight }]}>
          <Text style={[styles.scriptText, { color: colors.textSecondary }]}>
            {scriptDiff.map((item, i) => (
              <Text key={i} style={!item.matched ? { color: colors.error, backgroundColor: colors.error + '15' } : undefined}>
                {item.word}
                {i < scriptDiff.length - 1 ? ' ' : ''}
              </Text>
            ))}
          </Text>
        </View>
      </View>

      {/* AI 피드백 */}
      {feedback && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>AI 피드백</Text>
          <FeedbackSection feedback={feedback} />
        </View>
      )}

      {/* 버튼들 */}
      <View style={styles.buttonSection}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push(`/(student)/script/${id}/practice`)}
        >
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>다시 연습</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/(student)/script/${id}`)}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>스크립트 보기</Text>
        </Pressable>

        <Pressable
          style={styles.tertiaryButton}
          onPress={() => router.push('/(student)' as any)}
        >
          <Text style={[styles.tertiaryButtonText, { color: colors.textSecondary }]}>홈으로</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
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
  scoreSection: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  scoreBox: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 36,
    fontFamily: 'Pretendard-Bold',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  questionBox: {
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  transcriptionBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  transcriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  scriptBox: {
    padding: 16,
    borderRadius: 16,
  },
  scriptText: {
    fontSize: 15,
    lineHeight: 22,
  },
  buttonSection: {
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
  tertiaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    fontSize: 16,
  },
});
