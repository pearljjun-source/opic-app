import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 웹 전용: 직접 MediaRecorder API 사용 (expo-audio 웹 녹음 불안정)
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webMimeTypeRef = useRef<string>('audio/webm');

  // expo-audio hooks
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // TTS 재생 완료 감지
  useEffect(() => {
    if (playerStatus.didJustFinish && practiceState === 'playing') {
      setPracticeState('ready');
    }
  }, [playerStatus.didJustFinish]);

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

        // audio_url 없으면 백그라운드 TTS 프리로드 (버튼 클릭 시 즉시 재생 가능)
        if (!data.question.audio_url && data.question.id) {
          generateQuestionAudio(data.question.id).then(({ data: ttsData }) => {
            if (ttsData?.audioUrl) {
              setScript(prev => prev ? {
                ...prev,
                question: { ...prev.question, audio_url: ttsData.audioUrl },
              } : prev);
            }
          }).catch(() => {}); // 프리로드 실패는 무시 — 버튼 클릭 시 재시도
        }
      }
    };

    loadScript();
  }, [id]);

  // 클린업
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (Platform.OS === 'web' && webRecorderRef.current) {
        if (webRecorderRef.current.state !== 'inactive') {
          webRecorderRef.current.stop();
        }
        webRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        webRecorderRef.current = null;
      }
    };
  }, []);

  // 질문 오디오 재생 (TTS - 캐싱 지원)
  const handlePlayQuestion = async () => {
    if (!script) return;

    // 재생 중이면 정지
    if (practiceState === 'playing') {
      player.pause();
      setPracticeState('ready');
      return;
    }

    try {
      setPracticeState('playing');

      // audio_url이 이미 있으면 바로 재생, 없으면 TTS 생성
      let audioUrl = script.question.audio_url;

      if (!audioUrl) {
        const { data: ttsData, error: ttsError } = await generateQuestionAudio(
          script.question.id,
        );

        if (ttsError || !ttsData) {
          Alert.alert('오류', getUserMessage(ttsError) || '오디오 생성에 실패했습니다.');
          setPracticeState('ready');
          return;
        }

        audioUrl = ttsData.audioUrl;

        // 같은 세션 내 반복 호출 방지: 로컬 state에 캐시
        setScript(prev => prev ? {
          ...prev,
          question: { ...prev.question, audio_url: audioUrl },
        } : prev);
      }

      player.replace({ uri: audioUrl });
      player.play();
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Error playing audio:', err);
      Alert.alert('오류', '오디오 재생에 실패했습니다.');
      setPracticeState('ready');
    }
  };

  // 녹음 시작
  const handleStartRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        // 웹: 직접 MediaRecorder API 사용 (expo-audio 웹 녹음 불안정)
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
          Alert.alert('오류', '이 브라우저에서는 녹음을 지원하지 않습니다.');
          return;
        }

        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
        if (!mimeType) {
          Alert.alert('오류', '이 브라우저에서 지원하는 오디오 형식이 없습니다.');
          return;
        }

        webMimeTypeRef.current = mimeType;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType });

        webChunksRef.current = [];
        mediaRecorder.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0) webChunksRef.current.push(e.data);
        });

        mediaRecorder.start();
        webRecorderRef.current = mediaRecorder;
      } else {
        // 네이티브: expo-audio
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          Alert.alert(
            '권한 필요',
            '녹음을 위해 마이크 권한이 필요합니다.',
            [{ text: '확인' }]
          );
          return;
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        await recorder.prepareToRecordAsync();
        recorder.record();
      }

      setPracticeState('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      if (__DEV__) console.warn('[AppError] Error starting recording:', err);
      const msg = err?.name === 'NotFoundError'
        ? '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.'
        : err?.name === 'NotAllowedError'
          ? '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.'
          : '녹음 시작에 실패했습니다.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('오류', msg);
      }
    }
  };

  // 녹음 중지 및 처리
  const handleStopRecording = async () => {
    if (!script || !id) return;

    try {
      // 타이머 정지
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setPracticeState('processing');
      setProcessingStep('upload');

      let uri: string | null = null;

      if (Platform.OS === 'web') {
        // 웹: MediaRecorder 중지 → Blob URL 생성
        if (webRecorderRef.current && webRecorderRef.current.state !== 'inactive') {
          const stopped = new Promise<void>((resolve) => {
            webRecorderRef.current!.addEventListener('stop', () => resolve(), { once: true });
          });
          webRecorderRef.current.stop();
          await stopped;
        }

        if (webChunksRef.current.length > 0) {
          const blob = new Blob(webChunksRef.current, { type: webMimeTypeRef.current });
          uri = URL.createObjectURL(blob);
        }

        // 스트림 정리
        webRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
        webRecorderRef.current = null;
      } else {
        // 네이티브: expo-audio
        await recorder.stop();
        uri = recorder.uri;

        // iOS: 녹음 모드 해제
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }

      if (!uri) {
        Alert.alert('오류', '녹음 파일을 찾을 수 없습니다.');
        setPracticeState('ready');
        return;
      }

      // 1. 파일 업로드 (확장자는 uploadRecording이 콘텐츠 타입에서 자동 결정)
      const { data: uploadData, error: uploadError } = await uploadRecording(uri, `practice_${Date.now()}`);

      if (uploadError || !uploadData) {
        Alert.alert('업로드 실패', getUserMessage(uploadError));
        setPracticeState('ready');
        return;
      }

      // 2+3. 연습 기록 생성 + STT 변환 (독립적이므로 병렬 실행)
      setProcessingStep('stt');
      const [practiceResult, sttResult] = await Promise.all([
        createPractice({
          scriptId: id,
          audioPath: uploadData.path,
          duration: recordingTime,
        }),
        transcribeAudio(uploadData.path),
      ]);

      if (practiceResult.error || !practiceResult.data) {
        Alert.alert('저장 실패', getUserMessage(practiceResult.error));
        setPracticeState('ready');
        return;
      }

      if (sttResult.error || !sttResult.data) {
        const msg = getUserMessage(sttResult.error);
        if (__DEV__) console.warn('[AppError] STT failed:', sttResult.error);
        Alert.alert('음성 인식 실패', msg + (__DEV__ ? `\n\n[DEV] ${sttResult.error?.message || 'unknown'}` : ''));
        setPracticeState('ready');
        return;
      }

      const practiceData = practiceResult.data;
      const sttData = sttResult.data;

      // 4. AI 피드백 (Edge Function에서 구독 entitlement 검증)
      setProcessingStep('feedback');
      const { data: feedbackData, error: feedbackError } = await generateFeedback(
        script.content,
        sttData.transcription,
        script.question?.question_type,
      );

      if (feedbackError || !feedbackData) {
        Alert.alert('AI 분석 실패', getUserMessage(feedbackError));
        setPracticeState('ready');
        return;
      }

      // 5. 연습 결과 업데이트
      setProcessingStep('done');
      const { error: updateError } = await updatePracticeWithFeedback({
        practiceId: practiceData.id,
        transcription: sttData.transcription,
        score: feedbackData.score,
        reproductionRate: feedbackData.reproductionRate,
        feedback: feedbackData.feedback,
      });

      if (updateError) {
        if (__DEV__) console.warn('[AppError] Failed to update practice:', updateError);
      }

      // 알림: 강사에게 연습 완료 알림 (fire-and-forget)
      notifyAction(NOTIFICATION_TYPES.PRACTICE_COMPLETED, practiceData.id).then((result) => {
        if (result.success && result.notification_log_id && !result.already_exists) {
          deliverNotification(result.notification_log_id);
        }
      });

      // 결과 화면으로 이동
      router.replace({
        pathname: '/(student)/script/[id]/result',
        params: { id, practiceId: practiceData.id },
      });
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Error processing recording:', err);
      Alert.alert('오류', getUserMessage(err));
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

  if (practiceState === 'processing') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.processingTitle, { color: colors.textPrimary }]}>{STEP_LABELS[processingStep]}</Text>
        <Text style={[styles.processingHint, { color: colors.textSecondary }]}>잠시만 기다려주세요.</Text>
      </View>
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
          disabled={practiceState === 'recording'}
        >
          <Ionicons
            name={practiceState === 'playing' ? 'stop' : 'play'}
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
            {practiceState === 'playing' ? '정지' : '질문 듣기'}
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

            {Platform.OS === 'web' ? (
              <div
                onClick={handleStopRecording}
                style={{
                  width: 100, height: 100, borderRadius: 50,
                  backgroundColor: '#4B5563',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Ionicons name="stop" size={32} color="#FFFFFF" />
              </div>
            ) : (
              <Pressable style={[styles.stopButton, { backgroundColor: colors.gray600 }]} onPress={handleStopRecording}>
                <Ionicons name="stop" size={32} color="#FFFFFF" />
              </Pressable>
            )}
            <Text style={[styles.stopHint, { color: colors.textSecondary }]}>탭하여 녹음 종료</Text>
          </>
        ) : (
          <>
            {Platform.OS === 'web' ? (
              <div
                onClick={practiceState === 'ready' ? handleStartRecording : undefined}
                style={{
                  width: 100, height: 100, borderRadius: 50,
                  backgroundColor: '#F87171',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: practiceState === 'ready' ? 'pointer' : 'default',
                  boxShadow: '0 4px 8px rgba(248,113,113,0.3)',
                }}
              >
                <Ionicons name="mic" size={40} color="#FFFFFF" />
              </div>
            ) : (
              <Pressable
                style={[styles.recordButton, { backgroundColor: colors.error, shadowColor: colors.error }]}
                onPress={handleStartRecording}
                disabled={practiceState !== 'ready'}
              >
                <Ionicons name="mic" size={40} color="#FFFFFF" />
              </Pressable>
            )}
            <Text style={[styles.recordHint, { color: colors.textSecondary }]}>탭하여 녹음 시작</Text>
          </>
        )}
      </View>

      {/* 취소 버튼 */}
      {Platform.OS === 'web' ? (
        <div
          onClick={practiceState !== 'recording' ? () => router.back() : undefined}
          style={{
            padding: 16, alignSelf: 'center' as const,
            cursor: practiceState !== 'recording' ? 'pointer' : 'default',
            opacity: practiceState === 'recording' ? 0.5 : 1,
          }}
        >
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>취소</Text>
        </div>
      ) : (
        <Pressable
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={practiceState === 'recording'}
        >
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>취소</Text>
        </Pressable>
      )}
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
    fontSize: Math.min(56, Math.round(Dimensions.get('window').width * 0.14)),
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
