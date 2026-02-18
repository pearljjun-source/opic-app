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
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getPracticeResult, PracticeResult } from '@/services/practices';
import { getUserMessage } from '@/lib/errors';
import { diffScript } from '@/lib/diff';
import FeedbackSection from '@/components/student/FeedbackSection';

export default function PracticeDetailScreen() {
  const colors = useThemeColors();
  const { practiceId } = useLocalSearchParams<{ practiceId: string }>();

  const [result, setResult] = useState<PracticeResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const scriptDiff = useMemo(
    () => result ? diffScript(result.script_content, result.transcription || '') : [],
    [result],
  );

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
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>결과 불러오는 중...</Text>
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error || '결과를 불러올 수 없습니다.'}</Text>
        <Pressable style={[styles.backButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
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
    <ScrollView style={[styles.container, { backgroundColor: colors.surfaceSecondary }]} contentContainerStyle={styles.content}>
      {/* 점수 */}
      <View style={styles.scoreSection}>
        <View style={[styles.scoreBox, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>점수</Text>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>{result.score ?? '-'}</Text>
        </View>
        <View style={[styles.scoreBox, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>재현율</Text>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>
            {result.reproduction_rate != null ? `${result.reproduction_rate}%` : '-'}
          </Text>
        </View>
        <View style={[styles.scoreBox, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>녹음 시간</Text>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>{formatDuration(result.duration)}</Text>
        </View>
      </View>

      {/* 녹음 재생 */}
      {result.audio_url && (
        <Pressable
          style={[styles.playButton, { backgroundColor: colors.primary + '15' }, isPlaying && { backgroundColor: colors.primary }]}
          onPress={handlePlayAudio}
          disabled={isPlaying}
        >
          <Ionicons
            name={isPlaying ? 'volume-high' : 'play'}
            size={20}
            color={isPlaying ? '#FFFFFF' : colors.primary}
          />
          <Text style={[styles.playButtonText, { color: colors.primary }, isPlaying && { color: '#FFFFFF' }]}>
            {isPlaying ? '재생 중...' : '내 녹음 듣기'}
          </Text>
        </Pressable>
      )}

      {/* 질문 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>질문</Text>
        <View style={[styles.questionBox, { backgroundColor: colors.primary + '10', borderLeftColor: colors.primary }]}>
          <Text style={[styles.questionText, { color: colors.textPrimary }]}>{result.question_text}</Text>
        </View>
      </View>

      {/* 내 답변 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>내 답변 (음성 인식 결과)</Text>
        <View style={[styles.contentBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.contentText, { color: colors.textPrimary }]}>
            {result.transcription || '음성 인식 결과가 없습니다.'}
          </Text>
        </View>
      </View>

      {/* 원본 스크립트 (빠뜨린 단어 빨간색 하이라이트) */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>원본 스크립트</Text>
        <View style={[styles.contentBox, { backgroundColor: colors.borderLight, borderColor: 'transparent' }]}>
          <Text style={[styles.contentText, { color: colors.textSecondary }]}>
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

      {/* 하단 버튼 */}
      <Pressable style={styles.backNavButton} onPress={() => router.back()}>
        <Text style={[styles.backNavButtonText, { color: colors.textSecondary }]}>목록으로 돌아가기</Text>
      </Pressable>
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
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  scoreSection: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  scoreBox: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  playButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
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
  contentBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 22,
  },
  backNavButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  backNavButtonText: {
    fontSize: 16,
  },
});
