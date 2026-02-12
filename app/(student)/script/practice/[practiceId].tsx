import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getPracticeResult, PracticeResult } from '@/services/practices';
import { getUserMessage } from '@/lib/errors';

export default function PracticeDetailScreen() {
  const { practiceId } = useLocalSearchParams<{ practiceId: string }>();

  const [result, setResult] = useState<PracticeResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const load = async () => {
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

    load();
  }, [practiceId]);

  const handlePlayAudio = async () => {
    if (!result?.audio_url) return;

    try {
      setIsPlaying(true);
      const { sound } = await Audio.Sound.createAsync(
        { uri: result.audio_url },
        { shouldPlay: true }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          setIsPlaying(false);
        }
      });
    } catch {
      setIsPlaying(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>결과 불러오는 중...</Text>
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.ERROR} />
        <Text style={styles.errorText}>{error || '결과를 불러올 수 없습니다.'}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  const feedback = result.feedback;
  const formatDuration = (sec: number | null) => {
    if (!sec) return '-';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 점수 */}
      <View style={styles.scoreSection}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>점수</Text>
          <Text style={styles.scoreValue}>{result.score ?? '-'}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>재현율</Text>
          <Text style={styles.scoreValue}>
            {result.reproduction_rate != null ? `${result.reproduction_rate}%` : '-'}
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>녹음 시간</Text>
          <Text style={styles.scoreValue}>{formatDuration(result.duration)}</Text>
        </View>
      </View>

      {/* 녹음 재생 */}
      {result.audio_url && (
        <Pressable
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={handlePlayAudio}
          disabled={isPlaying}
        >
          <Ionicons
            name={isPlaying ? 'volume-high' : 'play'}
            size={20}
            color={isPlaying ? COLORS.WHITE : COLORS.PRIMARY}
          />
          <Text style={[styles.playButtonText, isPlaying && { color: COLORS.WHITE }]}>
            {isPlaying ? '재생 중...' : '내 녹음 듣기'}
          </Text>
        </Pressable>
      )}

      {/* 질문 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>질문</Text>
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>{result.question_text}</Text>
        </View>
      </View>

      {/* 내 답변 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 답변 (음성 인식 결과)</Text>
        <View style={styles.contentBox}>
          <Text style={styles.contentText}>
            {result.transcription || '음성 인식 결과가 없습니다.'}
          </Text>
        </View>
      </View>

      {/* 원본 스크립트 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>원본 스크립트</Text>
        <View style={[styles.contentBox, { backgroundColor: COLORS.GRAY_100 }]}>
          <Text style={[styles.contentText, { color: COLORS.TEXT_SECONDARY }]}>
            {result.script_content}
          </Text>
        </View>
      </View>

      {/* AI 피드백 */}
      {feedback && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI 피드백</Text>
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackSummary}>{feedback.summary}</Text>

            {feedback.missed_phrases.length > 0 && (
              <View style={styles.feedbackSection}>
                <View style={styles.feedbackLabelRow}>
                  <Ionicons name="remove-circle-outline" size={16} color={COLORS.ERROR} />
                  <Text style={[styles.feedbackLabel, { color: COLORS.ERROR }]}>빠뜨린 표현</Text>
                </View>
                {feedback.missed_phrases.map((p, i) => (
                  <Text key={i} style={styles.feedbackItem}>• {p}</Text>
                ))}
              </View>
            )}

            {feedback.extra_phrases.length > 0 && (
              <View style={styles.feedbackSection}>
                <View style={styles.feedbackLabelRow}>
                  <Ionicons name="add-circle-outline" size={16} color={COLORS.SECONDARY} />
                  <Text style={[styles.feedbackLabel, { color: COLORS.SECONDARY }]}>추가된 표현</Text>
                </View>
                {feedback.extra_phrases.map((p, i) => (
                  <Text key={i} style={styles.feedbackItem}>• {p}</Text>
                ))}
              </View>
            )}

            {feedback.pronunciation_tips.length > 0 && (
              <View style={styles.feedbackSection}>
                <View style={styles.feedbackLabelRow}>
                  <Ionicons name="mic-outline" size={16} color={COLORS.PRIMARY} />
                  <Text style={[styles.feedbackLabel, { color: COLORS.PRIMARY }]}>발음 팁</Text>
                </View>
                {feedback.pronunciation_tips.map((p, i) => (
                  <Text key={i} style={styles.feedbackItem}>• {p}</Text>
                ))}
              </View>
            )}

            {feedback.grammar_issues.length > 0 && (
              <View style={styles.feedbackSection}>
                <View style={styles.feedbackLabelRow}>
                  <Ionicons name="create-outline" size={16} color={COLORS.WARNING} />
                  <Text style={[styles.feedbackLabel, { color: COLORS.WARNING }]}>문법 교정</Text>
                </View>
                {feedback.grammar_issues.map((p, i) => (
                  <Text key={i} style={styles.feedbackItem}>• {p}</Text>
                ))}
              </View>
            )}

            {feedback.suggestions.length > 0 && (
              <View style={styles.feedbackSection}>
                <View style={styles.feedbackLabelRow}>
                  <Ionicons name="bulb-outline" size={16} color={COLORS.PRIMARY} />
                  <Text style={[styles.feedbackLabel, { color: COLORS.PRIMARY }]}>개선 제안</Text>
                </View>
                {feedback.suggestions.map((p, i) => (
                  <Text key={i} style={styles.feedbackItem}>• {p}</Text>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* 하단 버튼 */}
      <Pressable style={styles.backNavButton} onPress={() => router.back()}>
        <Text style={styles.backNavButtonText}>목록으로 돌아가기</Text>
      </Pressable>
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
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
  scoreSection: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  scoreBox: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY + '15',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.PRIMARY,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY + '15',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  playButtonActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  playButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
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
  contentBox: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  contentText: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
  },
  feedbackBox: {
    backgroundColor: COLORS.WARNING + '15',
    padding: 16,
    borderRadius: 16,
  },
  feedbackSummary: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 16,
    lineHeight: 22,
  },
  feedbackSection: {
    marginTop: 12,
  },
  feedbackLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  feedbackLabel: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  feedbackItem: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 22,
    marginBottom: 4,
    lineHeight: 20,
  },
  backNavButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  backNavButtonText: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
  },
});
