import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
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
import { NOTIFICATION_TYPES } from '@/lib/constants';
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
  const { id } = useLocalSearchParams<{ id: string }>();

  const [script, setScript] = useState<StudentScriptDetail | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState>('loading');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('upload');
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
    if (!recordingRef.current || !script || !id) return;

    try {
      // 타이머 정지
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setPracticeState('processing');
      setProcessingStep('upload');

      // 녹음 중지
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        Alert.alert('오류', '녹음 파일을 찾을 수 없습니다.');
        setPracticeState('ready');
        return;
      }

      // 1. 파일 업로드
      const fileName = `practice_${Date.now()}.m4a`;
      const { data: uploadData, error: uploadError } = await uploadRecording(uri, fileName);

      if (uploadError || !uploadData) {
        Alert.alert('업로드 실패', getUserMessage(uploadError));
        setPracticeState('ready');
        return;
      }

      // 2. 연습 기록 생성
      setProcessingStep('save');
      const { data: practiceData, error: practiceError } = await createPractice({
        scriptId: id,
        audioPath: uploadData.path,
        duration: recordingTime,
      });

      if (practiceError || !practiceData) {
        Alert.alert('저장 실패', getUserMessage(practiceError));
        setPracticeState('ready');
        return;
      }

      // 3. STT 변환
      setProcessingStep('stt');
      const { data: sttData, error: sttError } = await transcribeAudio(uploadData.path);

      if (sttError || !sttData) {
        const msg = getUserMessage(sttError);
        if (__DEV__) console.warn('[AppError] STT failed:', sttError);
        Alert.alert('음성 인식 실패', msg + (__DEV__ ? `\n\n[DEV] ${sttError?.message || 'unknown'}` : ''));
        setPracticeState('ready');
        return;
      }

      // 4. AI 피드백 생성
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>준비 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.ERROR} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  if (practiceState === 'processing') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.processingTitle}>{STEP_LABELS[processingStep]}</Text>
        <Text style={styles.processingHint}>잠시만 기다려주세요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 질문 표시 */}
      <View style={styles.questionSection}>
        <Text style={styles.questionLabel}>질문</Text>
        <Text style={styles.questionText}>{script?.question.question_text}</Text>
      </View>

      {/* 안내 */}
      <View style={styles.hintSection}>
        <Ionicons name="bulb-outline" size={20} color={COLORS.WARNING} />
        <Text style={styles.hintText}>
          질문을 듣고, 스크립트를 보지 않고 답변해보세요!
        </Text>
      </View>

      {/* 질문 듣기 버튼 */}
      <View style={styles.audioSection}>
        <Pressable
          style={[
            styles.playButton,
            practiceState === 'playing' && styles.playButtonActive,
          ]}
          onPress={handlePlayQuestion}
          disabled={practiceState !== 'ready'}
        >
          <Ionicons
            name={practiceState === 'playing' ? 'volume-high' : 'play'}
            size={24}
            color={practiceState === 'playing' ? COLORS.WHITE : COLORS.PRIMARY}
          />
          <Text
            style={[
              styles.playButtonText,
              practiceState === 'playing' && styles.playButtonTextActive,
            ]}
          >
            {practiceState === 'playing' ? '재생 중...' : '질문 듣기'}
          </Text>
        </Pressable>
      </View>

      {/* 녹음 섹션 */}
      <View style={styles.recordSection}>
        <Text style={styles.timer}>{formatTime(recordingTime)}</Text>

        {practiceState === 'recording' ? (
          <>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>녹음 중</Text>
            </View>

            <Pressable style={styles.stopButton} onPress={handleStopRecording}>
              <Ionicons name="stop" size={32} color={COLORS.WHITE} />
            </Pressable>
            <Text style={styles.stopHint}>탭하여 녹음 종료</Text>
          </>
        ) : (
          <>
            <Pressable
              style={styles.recordButton}
              onPress={handleStartRecording}
              disabled={practiceState !== 'ready'}
            >
              <Ionicons name="mic" size={40} color={COLORS.WHITE} />
            </Pressable>
            <Text style={styles.recordHint}>탭하여 녹음 시작</Text>
          </>
        )}
      </View>

      {/* 취소 버튼 */}
      <Pressable
        style={styles.cancelButton}
        onPress={() => router.back()}
        disabled={practiceState === 'recording'}
      >
        <Text style={styles.cancelButtonText}>취소</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    padding: 16,
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
  processingTitle: {
    marginTop: 16,
    fontSize: 20,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  processingHint: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  questionSection: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  questionLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
    lineHeight: 24,
  },
  hintSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WARNING + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
  },
  audioSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY + '15',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  playButtonActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  playButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
  },
  playButtonTextActive: {
    color: COLORS.WHITE,
  },
  recordSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timer: {
    fontSize: 56,
    fontWeight: '300',
    color: COLORS.TEXT_PRIMARY,
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
    backgroundColor: COLORS.ERROR,
  },
  recordingText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.ERROR,
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.ERROR,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.ERROR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stopButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.GRAY_600,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordHint: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  stopHint: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
  },
});
