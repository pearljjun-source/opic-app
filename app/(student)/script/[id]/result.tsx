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

import { COLORS } from '@/lib/constants';
import { getPracticeResult, PracticeResult } from '@/services/practices';
import { getUserMessage } from '@/lib/errors';
import { diffScript } from '@/lib/diff';
import FeedbackSection from '@/components/student/FeedbackSection';

export default function ResultScreen() {
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>결과 불러오는 중...</Text>
      </View>
    );
  }

  // 에러 상태
  if (error || !result) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.ERROR} />
        <Text style={styles.errorText}>{error || '결과를 불러올 수 없습니다.'}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  const feedback = result.feedback;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 점수 섹션 */}
      <View style={styles.scoreSection}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>점수</Text>
          <Text style={styles.scoreValue}>{result.score ?? '-'}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>재현율</Text>
          <Text style={styles.scoreValue}>
            {result.reproduction_rate ? `${result.reproduction_rate}%` : '-'}
          </Text>
        </View>
      </View>

      {/* 질문 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>질문</Text>
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>{result.question_text}</Text>
        </View>
      </View>

      {/* 내 답변 (STT 결과) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 답변 (음성 인식 결과)</Text>
        <View style={styles.transcriptionBox}>
          <Text style={styles.transcriptionText}>
            {result.transcription || '음성 인식 결과가 없습니다.'}
          </Text>
        </View>
      </View>

      {/* 원본 스크립트 (빠뜨린 단어 빨간색 하이라이트) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>원본 스크립트</Text>
        <View style={styles.scriptBox}>
          <Text style={styles.scriptText}>
            {scriptDiff.map((item, i) => (
              <Text key={i} style={!item.matched ? styles.missedWord : undefined}>
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
          <Text style={styles.sectionTitle}>AI 피드백</Text>
          <FeedbackSection feedback={feedback} />
        </View>
      )}

      {/* 버튼들 */}
      <View style={styles.buttonSection}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push(`/(student)/script/${id}/practice`)}
        >
          <Ionicons name="refresh" size={20} color={COLORS.WHITE} />
          <Text style={styles.primaryButtonText}>다시 연습</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push(`/(student)/script/${id}`)}
        >
          <Text style={styles.secondaryButtonText}>스크립트 보기</Text>
        </Pressable>

        <Pressable
          style={styles.tertiaryButton}
          onPress={() => router.push('/(student)' as any)}
        >
          <Text style={styles.tertiaryButtonText}>홈으로</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
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
  scoreSection: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  scoreBox: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY + '15',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 36,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.PRIMARY,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  questionBox: {
    backgroundColor: COLORS.PRIMARY + '10',
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
  },
  questionText: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
  },
  transcriptionBox: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  transcriptionText: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
  },
  scriptBox: {
    backgroundColor: COLORS.GRAY_100,
    padding: 16,
    borderRadius: 16,
  },
  scriptText: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
  },
  missedWord: {
    color: COLORS.ERROR,
    backgroundColor: COLORS.ERROR + '15',
  },
  buttonSection: {
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.WHITE,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  secondaryButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
  tertiaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
  },
});
