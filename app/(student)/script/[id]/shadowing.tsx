import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getStudentScript, StudentScriptDetail } from '@/services/scripts';
import { generateScriptAudio } from '@/services/practices';
import { getUserMessage } from '@/lib/errors';

type ShadowingState = 'loading' | 'ready' | 'playing_tts' | 'recording' | 'playing_recording';

/** 문장 분리: 마침표/물음표/느낌표 뒤의 공백 기준 */
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.?!])\s+/).filter((s) => s.trim().length > 0);
  return parts.length > 0 ? parts : [text];
}

export default function ShadowingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [script, setScript] = useState<StudentScriptDetail | null>(null);
  const [state, setState] = useState<ShadowingState>('loading');
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSentence, setActiveSentence] = useState(-1);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingUriRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);

  // 문장 분리
  const sentences = useMemo(() => {
    if (!script) return [];
    return splitSentences(script.content);
  }, [script]);

  // 각 문장의 누적 비율 (글자 수 기반 시간 추정)
  const cumulativeRatios = useMemo(() => {
    const total = sentences.reduce((sum, s) => sum + s.length, 0);
    if (total === 0) return [];
    let cum = 0;
    return sentences.map((s) => {
      cum += s.length;
      return cum / total;
    });
  }, [sentences]);

  // 스크립트 로드
  useEffect(() => {
    const loadScript = async () => {
      if (!id) return;
      const { data, error: fetchError } = await getStudentScript(id);
      if (fetchError) {
        setError(getUserMessage(fetchError));
        setState('ready');
      } else if (data) {
        setScript(data);
        setState('ready');
      }
    };
    loadScript();
  }, [id]);

  // 클린업
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync();
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  // 현재 문장 변경 시 자동 스크롤
  useEffect(() => {
    if (activeSentence < 0 || !contentHeightRef.current) return;
    const headerOffset = 50;
    const textHeight = contentHeightRef.current - headerOffset;
    const ratio = activeSentence > 0 ? cumulativeRatios[activeSentence - 1] : 0;
    const y = headerOffset + ratio * textHeight;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 30), animated: true });
  }, [activeSentence, cumulativeRatios]);

  // 재생 상태 콜백 (문장 하이라이트 동기화)
  const onPlaybackStatus = useCallback(
    (status: { isLoaded: boolean; isPlaying?: boolean; didJustFinish?: boolean; positionMillis?: number; durationMillis?: number }) => {
      if (!status.isLoaded) return;

      if (status.didJustFinish) {
        soundRef.current?.unloadAsync();
        soundRef.current = null;
        setActiveSentence(-1);
        setState('ready');
        return;
      }

      if (status.isPlaying && status.durationMillis && status.durationMillis > 0) {
        const progress = (status.positionMillis ?? 0) / status.durationMillis;
        for (let i = 0; i < cumulativeRatios.length; i++) {
          if (progress <= cumulativeRatios[i]) {
            setActiveSentence(i);
            break;
          }
        }
      }
    },
    [cumulativeRatios],
  );

  // ── TTS 재생 ──
  const handlePlayTTS = async () => {
    if (!script) return;

    try {
      setState('playing_tts');
      setActiveSentence(0);

      const { data: ttsData, error: ttsError } = await generateScriptAudio(id!);
      if (ttsError || !ttsData) {
        Alert.alert('오류', 'TTS 오디오 생성에 실패했습니다.');
        setActiveSentence(-1);
        setState('ready');
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: ttsData.audioUrl },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(onPlaybackStatus);
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Error playing TTS:', err);
      Alert.alert('오류', 'TTS 재생에 실패했습니다.');
      setActiveSentence(-1);
      setState('ready');
    }
  };

  // ── TTS 중지 ──
  const handleStopTTS = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setActiveSentence(-1);
    setState('ready');
  };

  // ── 녹음 시작 ──
  const handleStartRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('권한 필요', '녹음을 위해 마이크 권한이 필요합니다.', [{ text: '확인' }]);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setState('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Error starting recording:', err);
      Alert.alert('오류', '녹음 시작에 실패했습니다.');
    }
  };

  // ── 녹음 중지 ──
  const handleStopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        recordingUriRef.current = uri;
        setHasRecording(true);
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      setState('ready');
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Error stopping recording:', err);
      Alert.alert('오류', '녹음 중지에 실패했습니다.');
      setState('ready');
    }
  };

  // ── 녹음 재생 ──
  const handlePlayRecording = async () => {
    if (!recordingUriRef.current) return;

    try {
      setState('playing_recording');
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordingUriRef.current },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
          setState('ready');
        }
      });
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Error playing recording:', err);
      Alert.alert('오류', '녹음 재생에 실패했습니다.');
      setState('ready');
    }
  };

  // ── 재생 중지 ──
  const handleStopPlaying = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setState('ready');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── 로딩 ──
  if (state === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>준비 중...</Text>
      </View>
    );
  }

  // ── 에러 ──
  if (error || !script) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.ERROR} />
        <Text style={styles.errorText}>{error || '스크립트를 찾을 수 없습니다'}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  const isTTSPlaying = state === 'playing_tts';

  return (
    <View style={styles.container}>
      {/* ── 스크립트 (문장별 하이라이트) ── */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scriptSection}
        contentContainerStyle={styles.scriptContentContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => {
          contentHeightRef.current = h;
        }}
      >
        <View style={styles.scriptHeader}>
          <Ionicons name="document-text" size={18} color={COLORS.PRIMARY} />
          <Text style={styles.scriptTitle}>스크립트</Text>
          {isTTSPlaying && (
            <View style={styles.playingBadge}>
              <Ionicons name="volume-high" size={11} color={COLORS.WHITE} />
              <Text style={styles.playingBadgeText}>재생 중</Text>
            </View>
          )}
        </View>
        <Text style={styles.scriptContent}>
          {sentences.map((sentence, i) => (
            <Text
              key={i}
              style={
                i === activeSentence
                  ? styles.highlightedSentence
                  : isTTSPlaying && i < activeSentence
                    ? styles.completedSentence
                    : undefined
              }
            >
              {sentence}
              {i < sentences.length - 1 ? ' ' : ''}
            </Text>
          ))}
        </Text>
      </ScrollView>

      {/* ── 컴팩트 컨트롤 ── */}
      <View style={styles.controlSection}>
        {/* TTS 듣기 / 중지 */}
        {isTTSPlaying ? (
          <Pressable style={styles.ttsStopButton} onPress={handleStopTTS}>
            <Ionicons name="stop-circle" size={20} color={COLORS.ERROR} />
            <Text style={styles.ttsStopText}>발음 듣기 중지</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.ttsButton, state !== 'ready' && styles.buttonDisabled]}
            onPress={handlePlayTTS}
            disabled={state !== 'ready'}
          >
            <Ionicons name="volume-high" size={20} color={COLORS.PRIMARY} />
            <Text style={styles.ttsButtonText}>네이티브 발음 듣기</Text>
          </Pressable>
        )}

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 녹음 + 내 녹음 듣기 */}
        <View style={styles.recordRow}>
          {state === 'recording' ? (
            <>
              <View style={styles.recordingInfo}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTimeText}>{formatTime(recordingTime)}</Text>
              </View>
              <Pressable style={styles.stopRecordBtn} onPress={handleStopRecording}>
                <Ionicons name="stop" size={22} color={COLORS.WHITE} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[styles.recordBtn, state !== 'ready' && styles.buttonDisabled]}
                onPress={handleStartRecording}
                disabled={state !== 'ready'}
              >
                <Ionicons name="mic" size={22} color={COLORS.WHITE} />
              </Pressable>
              <Text style={styles.recordHint}>탭하여 녹음</Text>
            </>
          )}

          {hasRecording && state !== 'recording' && (
            <Pressable
              style={[
                styles.playRecBtn,
                state !== 'ready' && state !== 'playing_recording' && styles.buttonDisabled,
              ]}
              onPress={state === 'playing_recording' ? handleStopPlaying : handlePlayRecording}
              disabled={state !== 'ready' && state !== 'playing_recording'}
            >
              <Ionicons
                name={state === 'playing_recording' ? 'stop-circle' : 'play-circle'}
                size={20}
                color={state === 'playing_recording' ? COLORS.ERROR : COLORS.SECONDARY}
              />
              <Text
                style={[
                  styles.playRecText,
                  state === 'playing_recording' && { color: COLORS.ERROR },
                ]}
              >
                {state === 'playing_recording' ? '중지' : '내 녹음'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── 하단 ── */}
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
        disabled={state === 'recording'}
      >
        <Text style={styles.backButtonText}>스크립트로 돌아가기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
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

  // ── 스크립트 영역 ──
  scriptSection: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    margin: 12,
    marginBottom: 8,
    borderRadius: 16,
  },
  scriptContentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  scriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  scriptTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
  },
  playingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  playingBadgeText: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.WHITE,
  },
  scriptContent: {
    fontSize: 17,
    lineHeight: 28,
    color: COLORS.TEXT_PRIMARY,
  },
  highlightedSentence: {
    backgroundColor: COLORS.PRIMARY + '20',
    color: COLORS.PRIMARY,
  },
  completedSentence: {
    color: COLORS.TEXT_SECONDARY,
  },

  // ── 컨트롤 영역 (컴팩트) ──
  controlSection: {
    backgroundColor: COLORS.WHITE,
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ttsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY + '10',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
  },
  ttsButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
  },
  ttsStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.ERROR + '10',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
  },
  ttsStopText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.ERROR,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    marginVertical: 10,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.ERROR,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.ERROR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  stopRecordBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.GRAY_600,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordHint: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.ERROR,
  },
  recordingTimeText: {
    fontSize: 18,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.ERROR,
    fontVariant: ['tabular-nums'],
  },
  playRecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SECONDARY + '10',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    marginLeft: 'auto',
  },
  playRecText: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.SECONDARY,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // ── 하단 ──
  backButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
  },
});
