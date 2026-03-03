import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  BackHandler,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { EXAM_CONFIG, EXAM_TYPE_LABELS } from '@/lib/constants';
import { abandonExamSession, generateLevelTestQuestions, checkExamAvailability, createExamSession } from '@/services/exams';
import { useAuth } from '@/hooks/useAuth';
import { generateQuestionAudio } from '@/services/practices';
import { getUserMessage } from '@/lib/errors';
import type { ExamType, ExamRecording } from '@/lib/types';
import type { GeneratedQuestion } from '@/services/exams';

type SessionState = 'loading' | 'ready' | 'playing_question' | 'recording' | 'between_questions' | 'exam_end';

export default function ExamSessionScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const {
    sessionId,
    examType,
    questions: questionsParam,
    scenarioContext,
  } = useLocalSearchParams<{
    sessionId: string;
    examType: string;
    questions: string;
    scenarioContext?: string;
  }>();

  // 문항 데이터
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 상태
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const [recordingTime, setRecordingTime] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);

  // 녹음 데이터 (로컬)
  const [recordings, setRecordings] = useState<ExamRecording[]>([]);

  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { currentOrg } = useAuth();
  const sessionIdRef = useRef(sessionId);
  const isActionRef = useRef(false);
  const isInitRef = useRef(false);
  const currentQuestionRef = useRef<GeneratedQuestion | null>(null);
  const recordingTimeRef = useRef(0);

  const currentQuestion = questions[currentIndex];
  const isMockExam = (examType as ExamType) === 'mock_exam';
  const totalTime = isMockExam ? EXAM_CONFIG.MOCK_EXAM_DURATION_SEC : 0;

  // Ref 동기화 (stale closure 방지 — handleTimeUp에서 사용)
  useEffect(() => { currentQuestionRef.current = currentQuestion || null; }, [currentQuestion]);
  useEffect(() => { recordingTimeRef.current = recordingTime; }, [recordingTime]);

  // 문항 로드 (또는 레벨 테스트 시 생성)
  useEffect(() => {
    if (questionsParam) {
      // 모의고사/콤보: 이미 생성된 문항 사용
      try {
        const parsed = JSON.parse(questionsParam) as GeneratedQuestion[];
        setQuestions(parsed);
        setSessionState('ready');
      } catch {
        Alert.alert('오류', '문제 데이터를 불러올 수 없습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      }
    } else if (examType === 'level_test') {
      // 레벨 테스트: 문항 생성 + 세션 생성 (멱등성 가드)
      if (!isInitRef.current) {
        isInitRef.current = true;
        initLevelTest();
      }
    } else {
      // 필수 파라미터 누락 → 진입 불가
      Alert.alert('오류', '문제 데이터가 없습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    }
  }, [questionsParam, examType]);

  const initLevelTest = async () => {
    try {
      const availability = await checkExamAvailability('level_test', EXAM_CONFIG.LEVEL_TEST_QUESTION_COUNT);
      if (!availability.success) {
        Alert.alert('시험 불가', availability.error || '시험을 시작할 수 없습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
        return;
      }

      const { data, error } = await generateLevelTestQuestions();
      if (error || !data) {
        Alert.alert('오류', getUserMessage(error) || '문제 생성에 실패했습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
        return;
      }

      const { data: sessionData, error: sessionError } = await createExamSession({
        examType: 'level_test',
        organizationId: currentOrg?.id,
        questions: data.questions,
      });

      if (sessionError || !sessionData) {
        Alert.alert('오류', getUserMessage(sessionError) || '세션 생성에 실패했습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
        return;
      }

      sessionIdRef.current = sessionData.sessionId;
      setQuestions(data.questions);
      setSessionState('ready');
    } catch (err) {
      Alert.alert('오류', getUserMessage(err), [
        { text: '확인', onPress: () => router.back() },
      ]);
    }
  };

  // 전체 타이머 (모의고사만)
  useEffect(() => {
    if (!isMockExam || sessionState === 'loading' || sessionState === 'exam_end') return;

    totalTimerRef.current = setInterval(() => {
      setTotalElapsed((prev) => {
        const next = prev + 1;
        if (next >= totalTime) {
          // 즉시 interval 제거 → handleTimeUp 다중 호출 방지
          if (totalTimerRef.current) {
            clearInterval(totalTimerRef.current);
            totalTimerRef.current = null;
          }
          handleTimeUp();
          return next;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    };
  }, [isMockExam, sessionState === 'loading', sessionState === 'exam_end']);

  // 뒤로가기 차단
  useEffect(() => {
    const onBackPress = () => {
      confirmAbandon();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [sessionIdRef.current]);

  // 클린업
  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync();
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  // 시간 초과
  const handleTimeUp = useCallback(() => {
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    if (recTimerRef.current) clearInterval(recTimerRef.current);

    // 현재 녹음 중이면 중단하고 저장 (refs 사용 → stale closure 방지)
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().then(() => {
        const uri = recordingRef.current?.getURI();
        recordingRef.current = null;
        const q = currentQuestionRef.current;
        if (uri && q) {
          setRecordings((prev) => [...prev, {
            questionOrder: q.question_order,
            questionId: q.question_id || q.roleplay_question_id || '',
            questionType: q.source === 'roleplay_question' ? 'roleplay_question' : 'question',
            uri,
            duration: recordingTimeRef.current,
          }]);
        }
        setSessionState('exam_end');
      }).catch(() => {
        recordingRef.current = null;
        setSessionState('exam_end');
      });
    } else {
      setSessionState('exam_end');
    }
  }, []); // deps 없음 — 모든 값을 refs로 접근

  // 포기 확인
  const confirmAbandon = () => {
    Alert.alert(
      '시험 종료',
      '시험을 포기하시겠습니까? 녹음된 답변은 모두 삭제됩니다.',
      [
        { text: '계속 진행', style: 'cancel' },
        {
          text: '포기',
          style: 'destructive',
          onPress: async () => {
            try {
              if (sessionIdRef.current) await abandonExamSession(sessionIdRef.current);
            } catch {
              if (__DEV__) console.warn('[AppError] Failed to abandon session');
            }
            router.replace(routes.examHub as any);
          },
        },
      ]
    );
  };

  // 질문 오디오 재생
  const handlePlayQuestion = async () => {
    if (!currentQuestion) return;

    // 재생 중 정지 (토글)
    if (sessionState === 'playing_question' && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setSessionState('ready');
      return;
    }

    // 이중 탭 가드
    if (isActionRef.current) return;
    isActionRef.current = true;

    try {
      setSessionState('playing_question');

      // 롤플레이 질문은 audio_url 없으면 TTS 불가 (question_id 없으므로)
      // 일반 질문은 TTS 생성 가능
      let audioUrl: string | null = null;

      if (currentQuestion.source === 'question' && currentQuestion.question_id) {
        const { data: ttsData, error: ttsError } = await generateQuestionAudio(currentQuestion.question_id);
        if (ttsError) {
          if (__DEV__) console.warn('[AppError] TTS generate error:', ttsError);
          Alert.alert('음성 재생 실패', getUserMessage(ttsError));
          setSessionState('ready');
          return;
        }
        if (ttsData) {
          audioUrl = ttsData.audioUrl;
        }
      }

      if (!audioUrl) {
        // 롤플레이 등 TTS 미지원 문항 → 바로 ready로
        setSessionState('ready');
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
          setSessionState('ready');
        }
      });
    } catch (err) {
      if (__DEV__) console.warn('[AppError] TTS playback error:', err);
      // 사운드 leak 방지 — unload 후 null 처리
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setSessionState('ready');
    } finally {
      isActionRef.current = false;
    }
  };

  // 녹음 시작
  const handleStartRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('권한 필요', '녹음을 위해 마이크 권한이 필요합니다.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setSessionState('recording');
      setRecordingTime(0);

      recTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Recording start error:', err);
      // iOS: 녹음 모드에서 복구 (스피커 출력 복원)
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      Alert.alert('오류', '녹음 시작에 실패했습니다.');
    }
  };

  // 녹음 종료
  const handleStopRecording = async () => {
    if (!recordingRef.current || !currentQuestion) return;

    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        setRecordings((prev) => [...prev, {
          questionOrder: currentQuestion.question_order,
          questionId: currentQuestion.question_id || currentQuestion.roleplay_question_id || '',
          questionType: currentQuestion.source === 'roleplay_question' ? 'roleplay_question' : 'question',
          uri,
          duration: recordingTime,
        }]);
      }

      // 다음 문항 또는 시험 종료
      if (currentIndex < questions.length - 1) {
        setSessionState('between_questions');
      } else {
        setSessionState('exam_end');
      }
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Recording stop error:', err);
      recordingRef.current = null; // 실패한 녹음 ref leak 방지
      Alert.alert('오류', '녹음 저장에 실패했습니다.');
      setSessionState('ready');
    }
  };

  // 다음 문항
  const handleNextQuestion = () => {
    setCurrentIndex((prev) => prev + 1);
    setRecordingTime(0);
    setSessionState('ready');
  };

  // 건너뛰기
  const handleSkip = () => {
    if (currentIndex < questions.length - 1) {
      handleNextQuestion();
    } else {
      setSessionState('exam_end');
    }
  };

  // 시험 종료 → 처리 화면으로
  const handleFinish = () => {
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);

    if (recordings.length === 0) {
      Alert.alert('녹음 없음', '녹음된 답변이 없습니다. 시험을 포기하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        {
          text: '포기',
          style: 'destructive',
          onPress: async () => {
            try {
              if (sessionIdRef.current) await abandonExamSession(sessionIdRef.current);
            } catch {
              if (__DEV__) console.warn('[AppError] Failed to abandon session');
            }
            router.replace(routes.examHub as any);
          },
        },
      ]);
      return;
    }

    router.replace({
      pathname: routes.processing,
      params: {
        sessionId: sessionIdRef.current,
        recordings: JSON.stringify(recordings),
      },
    } as any);
  };

  // 시간 포맷
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const remainingTime = totalTime > 0 ? Math.max(0, totalTime - totalElapsed) : 0;

  // ===== 렌더링 =====

  if (sessionState === 'loading') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>시험 준비 중...</Text>
      </View>
    );
  }

  if (sessionState === 'exam_end') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={[styles.endTitle, { color: colors.textPrimary }]}>시험이 종료되었습니다</Text>
        <Text style={[styles.endSubtitle, { color: colors.textSecondary }]}>
          {recordings.length}개의 답변이 녹음되었습니다.{'\n'}
          결과 처리를 시작하시겠습니까?
        </Text>
        <Pressable
          style={[styles.finishButton, { backgroundColor: colors.primary }]}
          onPress={handleFinish}
        >
          <Text style={styles.finishButtonText}>결과 처리 시작</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }

  if (sessionState === 'between_questions') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
        <Text style={[styles.betweenTitle, { color: colors.textPrimary }]}>답변 완료!</Text>
        <Text style={[styles.betweenSubtitle, { color: colors.textSecondary }]}>
          Q{currentQuestion?.question_order}/{questions.length} 완료
        </Text>
        <Pressable
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNextQuestion}
        >
          <Text style={styles.nextButtonText}>다음 문항</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>
        <Pressable style={styles.betweenExitButton} onPress={() => setSessionState('exam_end')}>
          <Text style={[styles.betweenExitText, { color: colors.textDisabled }]}>여기까지 제출하기</Text>
        </Pressable>
      </View>
    );
  }

  // ready, playing_question, recording
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* 상단 바 */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={confirmAbandon} style={styles.exitButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={[styles.questionCounter, { color: colors.textPrimary }]}>
            Q{currentQuestion?.question_order}/{questions.length}
          </Text>
          {isMockExam && (
            <Text style={[styles.timer, { color: remainingTime < 300 ? colors.error : colors.textSecondary }]}>
              {formatTime(remainingTime)}
            </Text>
          )}
        </View>
        <View style={styles.exitButton} />
      </View>

      {/* 콤보 표시 */}
      {currentQuestion?.combo_number && currentQuestion.combo_position && (
        <View style={[styles.comboBanner, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.comboText, { color: colors.primary }]}>
            콤보 {currentQuestion.combo_number} - {currentQuestion.combo_position}/3
          </Text>
        </View>
      )}

      {/* 시나리오 컨텍스트 (콤보 롤플레이 첫 문항) */}
      {scenarioContext && currentIndex === 0 && (
        <View style={[styles.scenarioBox, { backgroundColor: colors.surface }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.scenarioText, { color: colors.textSecondary }]}>{scenarioContext}</Text>
        </View>
      )}

      {/* 질문 영역 */}
      <ScrollView
        style={styles.questionArea}
        contentContainerStyle={styles.questionAreaContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.questionCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.questionTypeLabel, { color: colors.textDisabled }]}>
            {currentQuestion?.question_type}
          </Text>
          <Text style={[styles.questionText, { color: colors.textPrimary }]}>
            {currentQuestion?.question_text}
          </Text>
        </View>

        {/* 질문 듣기 버튼 */}
        {currentQuestion?.source === 'question' && (
          <Pressable
            style={[
              styles.playButton,
              { backgroundColor: sessionState === 'playing_question' ? colors.primary : colors.primary + '15' },
            ]}
            onPress={handlePlayQuestion}
            disabled={sessionState === 'recording'}
          >
            <Ionicons
              name={sessionState === 'playing_question' ? 'stop' : 'volume-high'}
              size={20}
              color={sessionState === 'playing_question' ? '#FFFFFF' : colors.primary}
            />
            <Text style={[
              styles.playButtonText,
              { color: sessionState === 'playing_question' ? '#FFFFFF' : colors.primary },
            ]}>
              {sessionState === 'playing_question' ? '정지' : '질문 듣기'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* 녹음 영역 */}
      <View style={styles.recordArea}>
        <Text style={[styles.recTimer, { color: colors.textPrimary }]}>
          {formatTime(recordingTime)}
        </Text>

        {sessionState === 'recording' ? (
          <>
            <View style={styles.recordingIndicator}>
              <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.recordingLabel, { color: colors.error }]}>녹음 중</Text>
            </View>
            <Pressable
              style={[styles.micButton, { backgroundColor: colors.gray600 }]}
              onPress={handleStopRecording}
            >
              <Ionicons name="stop" size={32} color="#FFFFFF" />
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.micButton, { backgroundColor: colors.error, shadowColor: colors.error }]}
            onPress={handleStartRecording}
            disabled={sessionState === 'playing_question'}
          >
            <Ionicons name="mic" size={36} color="#FFFFFF" />
          </Pressable>
        )}

        {/* 건너뛰기 */}
        {sessionState !== 'recording' && (
          <Pressable style={styles.skipButton} onPress={handleSkip}>
            <Text style={[styles.skipText, { color: colors.textDisabled }]}>건너뛰기</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 15, fontFamily: 'Pretendard-Medium' },

  // 상단 바
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  exitButton: { width: 40, alignItems: 'center' },
  topBarCenter: { flex: 1, alignItems: 'center' },
  questionCounter: { fontSize: 16, fontFamily: 'Pretendard-Bold' },
  timer: { fontSize: 13, fontFamily: 'Pretendard-Medium', marginTop: 2, fontVariant: ['tabular-nums'] },

  // 콤보
  comboBanner: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  comboText: { fontSize: 13, fontFamily: 'Pretendard-SemiBold' },

  // 시나리오
  scenarioBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  scenarioText: { flex: 1, fontSize: 13, fontFamily: 'Pretendard-Regular', lineHeight: 20 },

  // 질문
  questionArea: { flex: 1, paddingHorizontal: 24 },
  questionAreaContent: { flexGrow: 1, justifyContent: 'center' },
  questionCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  questionTypeLabel: { fontSize: 12, fontFamily: 'Pretendard-Medium', marginBottom: 8, textTransform: 'uppercase' },
  questionText: { fontSize: 17, fontFamily: 'Pretendard-SemiBold', lineHeight: 26 },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  playButtonText: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },

  // 녹음
  recordArea: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 16,
  },
  recTimer: {
    fontSize: 40,
    fontWeight: '300',
    marginBottom: 16,
    fontVariant: ['tabular-nums'],
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5 },
  recordingLabel: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  skipButton: { marginTop: 20 },
  skipText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },

  // 문항 사이
  betweenTitle: { fontSize: 22, fontFamily: 'Pretendard-Bold', marginTop: 16 },
  betweenSubtitle: { fontSize: 14, fontFamily: 'Pretendard-Regular', marginTop: 8, marginBottom: 32 },
  betweenExitButton: { marginTop: 20, paddingVertical: 8 },
  betweenExitText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Pretendard-SemiBold' },

  // 시험 종료
  endTitle: { fontSize: 22, fontFamily: 'Pretendard-Bold', marginTop: 16 },
  endSubtitle: { fontSize: 14, fontFamily: 'Pretendard-Regular', marginTop: 8, marginBottom: 32, textAlign: 'center', lineHeight: 22 },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  finishButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Pretendard-SemiBold' },
});
