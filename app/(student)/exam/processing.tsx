import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { processExamResults } from '@/services/exams';
import { getUserMessage } from '@/lib/errors';
import type { ExamRecording } from '@/lib/types';

const STAGE_LABELS = {
  upload: '녹음 업로드 중',
  stt: '음성 인식 중',
  evaluate: 'AI 종합 평가 중',
} as const;

export default function ProcessingScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const { sessionId, recordings: recordingsParam } = useLocalSearchParams<{
    sessionId: string;
    recordings: string;
  }>();

  const [stage, setStage] = useState<'upload' | 'stt' | 'evaluate'>('upload');
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [failMessage, setFailMessage] = useState('');
  const isProcessing = useRef(false);

  // Android 뒤로가기 차단 (처리 중 이탈 방지)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const navigateToResult = useCallback(() => {
    router.replace({
      pathname: routes.result,
      params: { sessionId },
    } as any);
  }, [router, sessionId]);

  useEffect(() => {
    if (!sessionId || !recordingsParam || isProcessing.current) return;
    isProcessing.current = true;

    // JSON.parse 안전 처리
    let recordings: ExamRecording[];
    try {
      recordings = JSON.parse(recordingsParam);
    } catch {
      setFailed(true);
      setFailMessage('녹음 데이터를 읽을 수 없습니다.');
      return;
    }

    if (recordings.length === 0) {
      setFailed(true);
      setFailMessage('녹음된 답변이 없습니다.');
      return;
    }

    setTotal(recordings.length);

    processExamResults(sessionId, recordings, (s, c, t) => {
      setStage(s);
      setCurrent(c);
      setTotal(s === 'evaluate' ? 1 : t);
    }).then(({ data, error, partialSttFailures }) => {
      if (error && !data) {
        setFailed(true);
        setFailMessage(getUserMessage(error));
        return;
      }

      if (partialSttFailures && partialSttFailures > 0) {
        Alert.alert(
          '일부 인식 실패',
          `${partialSttFailures}개 답변의 음성 인식에 실패했습니다.\n나머지 답변으로 평가가 진행되었습니다.`,
          [{ text: '결과 보기', onPress: () => navigateToResult() }],
        );
      } else {
        navigateToResult();
      }
    });
  }, [sessionId, recordingsParam, navigateToResult]);

  const stageLabel = STAGE_LABELS[stage];
  const progressText = stage === 'evaluate'
    ? stageLabel + '...'
    : `${stageLabel} (${current}/${total})`;

  const progressPercent = total > 0
    ? stage === 'evaluate'
      ? 95
      : stage === 'stt'
        ? 30 + Math.round((current / total) * 50)
        : Math.round((current / total) * 30)
    : 0;

  // 실패 상태: 재시도 또는 결과 확인 버튼
  if (failed) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={styles.content}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>처리 실패</Text>
          <Text style={[styles.stage, { color: colors.textSecondary }]}>{failMessage}</Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              // 재시도: isProcessing 초기화 후 리로드
              isProcessing.current = false;
              setFailed(false);
              setStage('upload');
              setCurrent(0);
            }}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>재시도</Text>
          </Pressable>
          <Pressable style={styles.resultLink} onPress={navigateToResult}>
            <Text style={[styles.resultLinkText, { color: colors.textDisabled }]}>결과 화면으로 이동</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>시험 결과 처리 중</Text>
        <Text style={[styles.stage, { color: colors.textSecondary }]}>{progressText}</Text>

        {/* 진행률 바 */}
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progressPercent}%` }]}
          />
        </View>
        <Text style={[styles.percent, { color: colors.textDisabled }]}>{progressPercent}%</Text>

        <Text style={[styles.hint, { color: colors.textDisabled }]}>
          화면을 닫지 마세요. 처리가 완료되면 자동으로 이동합니다.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 40 },
  title: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    marginTop: 24,
    marginBottom: 8,
  },
  stage: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 24,
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  percent: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    marginTop: 8,
    marginBottom: 32,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
  resultLink: { marginTop: 16 },
  resultLinkText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
});
