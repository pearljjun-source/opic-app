import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { NOTIFICATION_TYPES } from '@/lib/constants';
import { getStudentScript, StudentScriptDetail } from '@/services/scripts';
import {
  createPractice,
  updatePracticeWithFeedback,
  uploadRecording,
  transcribeAudio,
  generateFeedback,
  generateQuestionAudio,
} from '@/services/practices';
import { notifyAction, deliverNotification } from '@/services/notifications';
import { getUserMessage } from '@/lib/errors';
import { checkFeatureAccess } from '@/services/billing';

type PracticeState = 'loading' | 'ready' | 'playing' | 'recording' | 'processing';
type ProcessingStep = 'upload' | 'save' | 'stt' | 'feedback' | 'done';

const STEP_LABELS: Record<ProcessingStep, string> = {
  upload: '녹음 파일 업로드 중...',
  save: '연습 기록 저장 중...',
  stt: '음성을 텍스트로 변환 중...',
  feedback: 'AI가 답변을 분석 중...',
  done: '완료!',
};

export default function PracticeScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [script, setScript] = useState<StudentScriptDetail | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState>('loading');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('upload');
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ★ 임시 디버그: 화면에 각 단계 로그 표시
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addDebugLog = (msg: string) => {
    setDebugLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 스크립트 로드
  useEffect(() => {
    const loadScript = async () => {
      if (!id) return;

      const { data, error: fetchError } = await getStudentScript(id);

      if (fetchError) {
        setError(getUserMessage(fetchError));
        setPracticeState('ready');
      } else if (data) {
        setScript(data);
        setPracticeState('ready');
      }
    };

    loadScript();
  }, [id]);

  // 클린업
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  // 질문 오디오 재생 (TTS - 캐싱 지원)
  const handlePlayQuestion = async () => {
    if (!script) return;

    try {
      setPracticeState('playing');

      // audio_url이 이미 있으면 바로 재생, 없으면 TTS 생성
      let audioUrl = script.question.audio_url;

      if (!audioUrl) {
        // TTS 구독 entitlement 체크
        const ttsAccess = await checkFeatureAccess('tts');
        if (!ttsAccess.allowed) {
          Alert.alert(
            '유료 플랜 필요',
            'TTS 음성은 유료 플랜에서 이용 가능합니다. 플랜을 업그레이드해 주세요.'
          );
          setPracticeState('ready');
          return;
        }

        const { data: ttsData, error: ttsError } = await generateQuestionAudio(
          script.question.id,
        );

        if (ttsError || !ttsData) {
          Alert.alert('오류', ttsError ? getUserMessage(ttsError) : '오디오 생성에 실패했습니다.');
          setPracticeState('ready');
          return;
        }

        audioUrl = ttsData.audioUrl;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          setPracticeState('ready');
        }
      });
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Error playing audio:', err);
      Alert.alert('오류', '오디오 재생에 실패했습니다.');
      setPracticeState('ready');
    }
  };

  // 녹음 시작
  const handleStartRecording = async () => {
    try {
      // 권한 요청
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          '권한 필요',
          '녹음을 위해 마이크 권한이 필요합니다.',
          [{ text: '확인' }]
        );
        return;
      }

      // 오디오 모드 설정
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // 녹음 시작
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setPracticeState('recording');
      setRecordingTime(0);

      // 타이머 시작
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Error starting recording:', err);
      Alert.alert('오류', '녹음 시작에 실패했습니다.');
    }
  };

  // 녹음 중지 및 처리
  const handleStopRecording = async () => {
    if (!recordingRef.current || !script || !id) {
      addDebugLog('⚠ EARLY RETURN: recordingRef/script/id 없음');
      return;
    }

    try {
      // 타이머 정지
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setDebugLogs([]); // 이전 로그 초기화
      setPracticeState('processing');
      setProcessingStep('upload');
      addDebugLog(`▶ 시작 (Platform: ${Platform.OS})`);

      // 녹음 중지
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      addDebugLog(`1. 녹음 중지 완료, URI: ${uri ? uri.substring(0, 60) + '...' : 'NULL'}`);

      if (!uri) {
        addDebugLog('❌ FAIL: URI가 null');
        setPracticeState('ready');
        return;
      }

      // 1. 파일 업로드
      const fileName = `practice_${Date.now()}.m4a`;
      addDebugLog(`2. 업로드 시작: ${fileName}`);
      const { data: uploadData, error: uploadError } = await uploadRecording(uri, fileName);

      if (uploadError || !uploadData) {
        addDebugLog(`❌ UPLOAD FAIL: ${uploadError?.message || 'data null'}`);
        addDebugLog(`   error type: ${uploadError?.constructor.name}`);
        addDebugLog(`   getUserMessage: ${getUserMessage(uploadError)}`);
        setPracticeState('ready');
        return;
      }
      addDebugLog(`✓ 업로드 성공: ${uploadData.path}`);

      // 2. 연습 기록 생성
      setProcessingStep('save');
      addDebugLog('3. createPractice 시작...');
      const { data: practiceData, error: practiceError } = await createPractice({
        scriptId: id,
        audioPath: uploadData.path,
        duration: recordingTime,
      });

      if (practiceError || !practiceData) {
        addDebugLog(`❌ CREATE FAIL: ${practiceError?.message || 'data null'}`);
        addDebugLog(`   getUserMessage: ${getUserMessage(practiceError)}`);
        setPracticeState('ready');
        return;
      }
      addDebugLog(`✓ 연습 생성: ${practiceData.id}`);

      // 3. STT 변환
      setProcessingStep('stt');
      addDebugLog('4. STT (whisper-stt) 시작...');
      const { data: sttData, error: sttError } = await transcribeAudio(uploadData.path);

      if (sttError || !sttData) {
        addDebugLog(`❌ STT FAIL: ${sttError?.message || 'data null'}`);
        addDebugLog(`   getUserMessage: ${getUserMessage(sttError)}`);
        setPracticeState('ready');
        return;
      }
      addDebugLog(`✓ STT 성공: "${sttData.transcription.substring(0, 50)}..."`);

      // 4. AI 피드백 — 구독 entitlement 체크
      setProcessingStep('feedback');
      addDebugLog('5. checkFeatureAccess("ai_feedback") 시작...');
      const feedbackAccess = await checkFeatureAccess('ai_feedback');
      addDebugLog(`   결과: allowed=${feedbackAccess.allowed}, plan=${feedbackAccess.plan_key || 'N/A'}`);
      if (!feedbackAccess.allowed) {
        addDebugLog('❌ ENTITLEMENT DENIED: ai_feedback 불허');
        setPracticeState('ready');
        return;
      }

      addDebugLog('6. generateFeedback (claude-feedback) 시작...');
      const { data: feedbackData, error: feedbackError } = await generateFeedback(
        script.content,
        sttData.transcription,
        script.question?.question_type,
      );

      if (feedbackError || !feedbackData) {
        addDebugLog(`❌ FEEDBACK FAIL: ${feedbackError?.message || 'data null'}`);
        addDebugLog(`   getUserMessage: ${getUserMessage(feedbackError)}`);
        setPracticeState('ready');
        return;
      }
      addDebugLog(`✓ 피드백 성공: score=${feedbackData.score}, rate=${feedbackData.reproductionRate}`);

      // 5. 연습 결과 업데이트
      setProcessingStep('done');
      addDebugLog('7. updatePracticeWithFeedback 시작...');
      const { error: updateError } = await updatePracticeWithFeedback({
        practiceId: practiceData.id,
        transcription: sttData.transcription,
        score: feedbackData.score,
        reproductionRate: feedbackData.reproductionRate,
        feedback: feedbackData.feedback,
      });

      if (updateError) {
        addDebugLog(`⚠ UPDATE WARNING: ${updateError.message}`);
      } else {
        addDebugLog('✓ 결과 업데이트 성공');
      }

      // 알림: 강사에게 연습 완료 알림 (fire-and-forget)
      notifyAction(NOTIFICATION_TYPES.PRACTICE_COMPLETED, practiceData.id).then((result) => {
        if (result.success && result.notification_log_id && !result.already_exists) {
          deliverNotification(result.notification_log_id);
        }
      });

      addDebugLog('8. ✅ 완료! 결과 화면으로 이동합니다...');

      // 결과 화면으로 이동 (1초 후 — 로그 확인용)
      setTimeout(() => {
        router.replace({
          pathname: '/(student)/script/[id]/result',
          params: { id, practiceId: practiceData.id },
        });
      }, 1500);
    } catch (err: any) {
      addDebugLog(`❌ CATCH: ${err?.message || String(err)}`);
      addDebugLog(`   name: ${err?.name}, code: ${err?.code || 'N/A'}`);
      addDebugLog(`   stack: ${(err?.stack || '').substring(0, 200)}`);
      setPracticeState('ready');
    }
  };

  // 시간 포맷
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (practiceState === 'loading') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>준비 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  if (practiceState === 'processing' || debugLogs.length > 0) {
    return (
      <ScrollView
        style={[{ flex: 1, backgroundColor: colors.surfaceSecondary }]}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      >
        <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 12 }} />
        <Text style={[styles.processingTitle, { color: colors.textPrimary, textAlign: 'center' }]}>
          {STEP_LABELS[processingStep]}
        </Text>
        <Text style={[styles.processingHint, { color: colors.textSecondary, textAlign: 'center', marginBottom: 16 }]}>
          잠시만 기다려주세요.
        </Text>

        {/* ★ 디버그 로그 패널 */}
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, marginTop: 8 }}>
          <Text style={{ color: '#00ff88', fontSize: 12, fontFamily: 'Pretendard-SemiBold', marginBottom: 8 }}>
            🔍 DEBUG LOG (임시)
          </Text>
          {debugLogs.map((log, i) => (
            <Text
              key={i}
              style={{
                color: log.includes('❌') ? '#ff6b6b' : log.includes('✓') ? '#51cf66' : log.includes('⚠') ? '#ffd43b' : '#e0e0e0',
                fontSize: 11,
                fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
                lineHeight: 18,
                marginBottom: 2,
              }}
            >
              {log}
            </Text>
          ))}
          {debugLogs.length === 0 && (
            <Text style={{ color: '#666', fontSize: 11 }}>로그 대기 중...</Text>
          )}
        </View>

        {/* 에러 시 뒤로가기 버튼 */}
        {practiceState === 'ready' && debugLogs.some(l => l.includes('❌') || l.includes('CATCH')) && (
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary, alignSelf: 'center', marginTop: 16 }]}
            onPress={() => { setDebugLogs([]); }}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* 질문 표시 */}
      <View style={[styles.questionSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.questionLabel, { color: colors.textSecondary }]}>질문</Text>
        <Text style={[styles.questionText, { color: colors.primary }]}>{script?.question.question_text}</Text>
      </View>

      {/* 안내 */}
      <View style={[styles.hintSection, { backgroundColor: colors.warning + '15' }]}>
        <Ionicons name="bulb-outline" size={20} color={colors.warning} />
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          질문을 듣고, 스크립트를 보지 않고 답변해보세요!
        </Text>
      </View>

      {/* 질문 듣기 버튼 */}
      <View style={styles.audioSection}>
        <Pressable
          style={[
            styles.playButton,
            { backgroundColor: colors.primary + '15' },
            practiceState === 'playing' && { backgroundColor: colors.primary },
          ]}
          onPress={handlePlayQuestion}
          disabled={practiceState !== 'ready'}
        >
          <Ionicons
            name={practiceState === 'playing' ? 'volume-high' : 'play'}
            size={24}
            color={practiceState === 'playing' ? '#FFFFFF' : colors.primary}
          />
          <Text
            style={[
              styles.playButtonText,
              { color: colors.primary },
              practiceState === 'playing' && { color: '#FFFFFF' },
            ]}
          >
            {practiceState === 'playing' ? '재생 중...' : '질문 듣기'}
          </Text>
        </Pressable>
      </View>

      {/* 녹음 섹션 */}
      <View style={styles.recordSection}>
        <Text style={[styles.timer, { color: colors.textPrimary }]}>{formatTime(recordingTime)}</Text>

        {practiceState === 'recording' ? (
          <>
            <View style={styles.recordingIndicator}>
              <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.recordingText, { color: colors.error }]}>녹음 중</Text>
            </View>

            <Pressable style={[styles.stopButton, { backgroundColor: colors.gray600 }]} onPress={handleStopRecording}>
              <Ionicons name="stop" size={32} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.stopHint, { color: colors.textSecondary }]}>탭하여 녹음 종료</Text>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.recordButton, { backgroundColor: colors.error, shadowColor: colors.error }]}
              onPress={handleStartRecording}
              disabled={practiceState !== 'ready'}
            >
              <Ionicons name="mic" size={40} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.recordHint, { color: colors.textSecondary }]}>탭하여 녹음 시작</Text>
          </>
        )}
      </View>

      {/* 취소 버튼 */}
      <Pressable
        style={styles.cancelButton}
        onPress={() => router.back()}
        disabled={practiceState === 'recording'}
      >
        <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>취소</Text>
      </Pressable>
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
  processingTitle: {
    marginTop: 16,
    fontSize: 20,
    fontFamily: 'Pretendard-SemiBold',
  },
  processingHint: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  questionSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  questionLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
    lineHeight: 24,
  },
  hintSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
  },
  audioSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  playButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  recordSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timer: {
    fontSize: 56,
    fontWeight: '300',
    marginBottom: 24,
    fontVariant: ['tabular-nums'],
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recordingText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stopButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordHint: {
    marginTop: 16,
    fontSize: 14,
  },
  stopHint: {
    marginTop: 16,
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
  },
});
