import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useVoiceConsent } from '@/hooks/useVoiceConsent';
import { useRecordingTimer } from '@/hooks/useRecordingTimer';
import { formatDuration } from '@/lib/helpers';
import { NOTIFICATION_TYPES, PRACTICE_STEP_LABELS, type PracticeProcessingStep } from '@/lib/constants';
import { getStudentScript, translateScript, StudentScriptDetail } from '@/services/scripts';
import {
  createPractice,
  updatePracticeWithFeedback,
  uploadRecording,
  transcribeAudio,
  generateFeedback,
} from '@/services/practices';
import { notifyAction, deliverNotification } from '@/services/notifications';
import { getUserMessage } from '@/lib/errors';
import { alert as xAlert } from '@/lib/alert';
import { VoiceConsentModal } from '@/components/ui/VoiceConsentModal';

type PracticeState = 'loading' | 'translating' | 'ready' | 'recording' | 'processing';

const STEP_LABELS = PRACTICE_STEP_LABELS;

export default function TranslationPracticeScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { requireConsent, showConsentModal, handleAgree, handleDecline } = useVoiceConsent();

  const [consentLoading, setConsentLoading] = useState(false);
  const [script, setScript] = useState<StudentScriptDetail | null>(null);
  const [contentKo, setContentKo] = useState<string | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState>('loading');
  const [processingStep, setProcessingStep] = useState<PracticeProcessingStep>('upload');
  const recTimer = useRecordingTimer();
  const [error, setError] = useState<string | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);

  // 웹 전용: MediaRecorder API
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webMimeTypeRef = useRef<string>('audio/webm');

  // expo-audio hooks
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // 스크립트 + 번역 로드
  useEffect(() => {
    const load = async () => {
      if (!id) return;

      const { data, error: fetchError } = await getStudentScript(id);

      if (fetchError || !data) {
        setError(getUserMessage(fetchError));
        setPracticeState('ready');
        return;
      }

      setScript(data);

      // content_ko가 이미 캐시되어 있으면 바로 사용
      if (data.content_ko) {
        setContentKo(data.content_ko);
        setPracticeState('ready');
        return;
      }

      // 캐시 없음 → 번역 요청
      setPracticeState('translating');
      const { data: transData, error: transError } = await translateScript(id);

      if (transError || !transData) {
        setError('번역 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
        setPracticeState('ready');
        return;
      }

      setContentKo(transData.content_ko);
      setPracticeState('ready');
    };

    load();
  }, [id]);

  // 클린업
  useEffect(() => {
    return () => {
      recTimer.cleanup();
      if (Platform.OS === 'web' && webRecorderRef.current) {
        if (webRecorderRef.current.state !== 'inactive') {
          webRecorderRef.current.stop();
        }
        webRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        webRecorderRef.current = null;
      } else if (Platform.OS !== 'web' && recorder.isRecording) {
        recorder.stop();
      }
    };
  }, []);

  // 녹음 시작
  const handleStartRecording = async () => {
    if (!requireConsent()) return;

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
          xAlert('오류', '이 브라우저에서는 녹음을 지원하지 않습니다.');
          return;
        }

        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
        if (!mimeType) {
          xAlert('오류', '이 브라우저에서 지원하는 오디오 형식이 없습니다.');
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
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          xAlert('권한 필요', '녹음을 위해 마이크 권한이 필요합니다.');
          return;
        }

        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }

      setPracticeState('recording');
      recTimer.start();
    } catch (err: unknown) {
      if (__DEV__) console.warn('[AppError] Error starting recording:', err);
      const errName = err instanceof Error ? err.name : '';
      const msg = errName === 'NotFoundError'
        ? '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.'
        : errName === 'NotAllowedError'
          ? '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.'
          : '녹음 시작에 실패했습니다.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        xAlert('오류', msg);
      }
    }
  };

  // 녹음 중지 및 처리
  const handleStopRecording = async () => {
    if (!script || !id) return;

    try {
      recTimer.stop();

      setPracticeState('processing');
      setProcessingStep('upload');

      let uri: string | null = null;

      if (Platform.OS === 'web') {
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

        webRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
        webRecorderRef.current = null;
      } else {
        await recorder.stop();
        uri = recorder.uri;
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }

      if (!uri) {
        xAlert('오류', '녹음 파일을 찾을 수 없습니다.');
        setPracticeState('ready');
        return;
      }

      // 1. 파일 업로드
      const { data: uploadData, error: uploadError } = await uploadRecording(uri, `translation_${Date.now()}`);

      if (uploadError || !uploadData) {
        xAlert('업로드 실패', getUserMessage(uploadError));
        setPracticeState('ready');
        return;
      }

      // 2+3. 연습 기록 생성 + STT 변환 (병렬)
      setProcessingStep('stt');
      const [practiceResult, sttResult] = await Promise.all([
        createPractice({
          scriptId: id,
          audioPath: uploadData.path,
          duration: recTimer.seconds,
        }),
        transcribeAudio(uploadData.path),
      ]);

      if (practiceResult.error || !practiceResult.data) {
        xAlert('저장 실패', getUserMessage(practiceResult.error));
        setPracticeState('ready');
        return;
      }

      if (sttResult.error || !sttResult.data) {
        const msg = getUserMessage(sttResult.error);
        if (__DEV__) console.warn('[AppError] STT failed:', sttResult.error);
        xAlert('음성 인식 실패', msg + (__DEV__ ? `\n\n[DEV] ${sttResult.error?.message || 'unknown'}` : ''));
        setPracticeState('ready');
        return;
      }

      const practiceData = practiceResult.data;
      const sttData = sttResult.data;

      // 4. AI 피드백 (원본 영어 스크립트와 학생 답변 비교)
      setProcessingStep('feedback');
      const { data: feedbackData, error: feedbackError } = await generateFeedback(
        script.content,
        sttData.transcription,
        script.question?.question_type,
      );

      if (feedbackError || !feedbackData) {
        xAlert('AI 분석 실패', getUserMessage(feedbackError));
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

      // 알림 (fire-and-forget)
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
      xAlert('오류', getUserMessage(err));
      setPracticeState('ready');
    }
  };


  // ── 로딩 ──
  if (practiceState === 'loading') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>준비 중...</Text>
      </View>
    );
  }

  // ── 번역 생성 중 ──
  if (practiceState === 'translating') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.processingTitle, { color: colors.textPrimary }]}>한국어 번역 생성 중...</Text>
        <Text style={[styles.processingHint, { color: colors.textSecondary }]}>
          처음 한 번만 생성되며, 이후에는 바로 시작됩니다.
        </Text>
      </View>
    );
  }

  // ── 에러 ──
  if (error || !contentKo) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error || '번역을 불러올 수 없습니다'}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  // ── 처리 중 ──
  if (practiceState === 'processing') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.processingTitle, { color: colors.textPrimary }]}>{STEP_LABELS[processingStep]}</Text>
        <Text style={[styles.processingHint, { color: colors.textSecondary }]}>잠시만 기다려주세요.</Text>
      </View>
    );
  }

  // ── 메인 화면 ──
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* 한국어 스크립트 */}
      <ScrollView style={styles.scriptSection} showsVerticalScrollIndicator={false}>
        <View style={[styles.koreanCard, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}>
          <View style={styles.koreanHeader}>
            <Ionicons name="language" size={20} color={colors.primary} />
            <Text style={[styles.koreanLabel, { color: colors.primary }]}>한국어 스크립트</Text>
          </View>
          <Text style={[styles.koreanText, { color: colors.textPrimary }]}>{contentKo}</Text>
        </View>

        <View style={[styles.hintSection, { backgroundColor: colors.warning + '15' }]}>
          <Ionicons name="bulb-outline" size={20} color={colors.warning} />
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            한국어를 보고 영어로 말해보세요!
          </Text>
        </View>

        {/* 영어 스크립트 엿보기 */}
        <Pressable
          style={[styles.peekButton, {
            backgroundColor: showEnglish ? colors.primary + '15' : colors.surface,
            borderColor: colors.primary + '30',
          }]}
          onPress={() => setShowEnglish(!showEnglish)}
        >
          <Ionicons
            name={showEnglish ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={colors.primary}
          />
          <Text style={[styles.peekButtonText, { color: colors.primary }]}>
            {showEnglish ? '영어 스크립트 숨기기' : '영어 스크립트 확인하기'}
          </Text>
        </Pressable>

        {showEnglish && script?.content && (
          <View style={[styles.englishCard, {
            backgroundColor: colors.primary + '08',
            borderColor: colors.primary + '20',
          }]}>
            <View style={styles.koreanHeader}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={[styles.koreanLabel, { color: colors.primary }]}>영어 스크립트</Text>
            </View>
            <Text style={[styles.koreanText, { color: colors.textPrimary }]}>{script.content}</Text>
          </View>
        )}
      </ScrollView>

      {/* 녹음 섹션: 영어 스크립트 표시 중이면 컴팩트 바 */}
      {showEnglish ? (
        <View style={[styles.compactRecordSection, { backgroundColor: colors.surface }]}>
          {practiceState === 'recording' ? (
            <>
              <View style={styles.compactRecordingInfo}>
                <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
                <Text style={[styles.compactTimer, { color: colors.error }]}>{formatDuration(recTimer.seconds)}</Text>
              </View>
              {Platform.OS === 'web' ? (
                <div
                  onClick={handleStopRecording}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: '#4B5563',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Ionicons name="stop" size={20} color="#FFFFFF" />
                </div>
              ) : (
                <Pressable style={[styles.compactStopButton, { backgroundColor: colors.gray600 }]} onPress={handleStopRecording}>
                  <Ionicons name="stop" size={20} color="#FFFFFF" />
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.compactTimer, { color: colors.textSecondary }]}>{formatDuration(recTimer.seconds)}</Text>
              {Platform.OS === 'web' ? (
                <div
                  onClick={practiceState === 'ready' ? handleStartRecording : undefined}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: '#F87171',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: practiceState === 'ready' ? 'pointer' : 'default',
                    boxShadow: '0 2px 4px rgba(248,113,113,0.25)',
                  }}
                >
                  <Ionicons name="mic" size={20} color="#FFFFFF" />
                </div>
              ) : (
                <Pressable
                  style={[styles.compactRecordButton, { backgroundColor: colors.error, shadowColor: colors.error }]}
                  onPress={handleStartRecording}
                  disabled={practiceState !== 'ready'}
                >
                  <Ionicons name="mic" size={20} color="#FFFFFF" />
                </Pressable>
              )}
              <Text style={[styles.compactHint, { color: colors.textSecondary }]}>탭하여 녹음</Text>
            </>
          )}
        </View>
      ) : (
        <View style={styles.recordSection}>
          <Text style={[styles.timer, { color: colors.textPrimary }]}>{formatDuration(recTimer.seconds)}</Text>

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
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: '#4B5563',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Ionicons name="stop" size={28} color="#FFFFFF" />
                </div>
              ) : (
                <Pressable style={[styles.stopButton, { backgroundColor: colors.gray600 }]} onPress={handleStopRecording}>
                  <Ionicons name="stop" size={28} color="#FFFFFF" />
                </Pressable>
              )}
              <Text style={[styles.recordHint, { color: colors.textSecondary }]}>탭하여 녹음 종료</Text>
            </>
          ) : (
            <>
              {Platform.OS === 'web' ? (
                <div
                  onClick={practiceState === 'ready' ? handleStartRecording : undefined}
                  style={{
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: '#F87171',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: practiceState === 'ready' ? 'pointer' : 'default',
                    boxShadow: '0 4px 8px rgba(248,113,113,0.3)',
                  }}
                >
                  <Ionicons name="mic" size={32} color="#FFFFFF" />
                </div>
              ) : (
                <Pressable
                  style={[styles.recordButton, { backgroundColor: colors.error, shadowColor: colors.error }]}
                  onPress={handleStartRecording}
                  disabled={practiceState !== 'ready'}
                >
                  <Ionicons name="mic" size={32} color="#FFFFFF" />
                </Pressable>
              )}
              <Text style={[styles.recordHint, { color: colors.textSecondary }]}>탭하여 녹음 시작</Text>
            </>
          )}
        </View>
      )}

      {/* 취소 (컴팩트 모드에서는 숨김) */}
      {!showEnglish && (
        Platform.OS === 'web' ? (
          <div
            onClick={practiceState !== 'recording' ? () => router.back() : undefined}
            style={{
              padding: 12, alignSelf: 'center' as const,
              cursor: practiceState !== 'recording' ? 'pointer' : 'default',
              opacity: practiceState === 'recording' ? 0.5 : 1,
            }}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>취소</Text>
          </div>
        ) : (
          <Pressable
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={practiceState === 'recording'}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>취소</Text>
          </Pressable>
        )
      )}

      <VoiceConsentModal
        visible={showConsentModal}
        onAgree={async () => {
          setConsentLoading(true);
          const success = await handleAgree();
          setConsentLoading(false);
          if (!success) {
            xAlert('오류', '동의 저장에 실패했습니다. 다시 시도해주세요.');
          }
        }}
        onDecline={handleDecline}
        loading={consentLoading}
      />
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
  scriptSection: {
    flex: 1,
    marginBottom: 16,
  },
  koreanCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  koreanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  koreanLabel: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  koreanText: {
    fontSize: 17,
    lineHeight: 28,
  },
  hintSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
  },
  recordSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  timer: {
    fontSize: Math.min(48, Math.round(Dimensions.get('window').width * 0.12)),
    fontWeight: '300',
    marginBottom: 16,
    fontVariant: ['tabular-nums'],
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordHint: {
    marginTop: 12,
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
  },
  peekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  peekButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  englishCard: {
    marginTop: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },

  // ── 컴팩트 녹음 바 (영어 스크립트 표시 중) ──
  compactRecordSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  compactRecordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  compactStopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTimer: {
    fontSize: 18,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  compactRecordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  compactHint: {
    fontSize: 12,
  },
});
