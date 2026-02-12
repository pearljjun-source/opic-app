import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import {
  getPracticeForTeacher,
  saveTeacherFeedback,
  PracticeDetailForTeacher,
} from '@/services/practices';
import { notifyAction, deliverNotification } from '@/services/notifications';
import { NOTIFICATION_TYPES } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';

export default function TeacherPracticeDetailScreen() {
  const { id: studentId, practiceId } = useLocalSearchParams<{
    id: string;
    practiceId: string;
  }>();

  const [practice, setPractice] = useState<PracticeDetailForTeacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 피드백 상태
  const [feedbackText, setFeedbackText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 오디오 재생 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // 데이터 로드
  useEffect(() => {
    const loadPractice = async () => {
      if (!practiceId) {
        setError('연습 기록을 찾을 수 없습니다.');
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await getPracticeForTeacher(practiceId);

      if (fetchError) {
        setError(getUserMessage(fetchError));
      } else if (data) {
        setPractice(data);
        setFeedbackText(data.teacher_feedback?.feedback || '');
      }

      setIsLoading(false);
    };

    loadPractice();
  }, [practiceId]);

  // 클린업
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // 오디오 재생/정지
  const handleToggleAudio = async () => {
    if (!practice?.audio_url) {
      Alert.alert('알림', '녹음 파일이 없습니다.');
      return;
    }

    if (isPlaying && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setIsPlaying(false);
      return;
    }

    try {
      setIsPlaying(true);
      const { sound } = await Audio.Sound.createAsync(
        { uri: practice.audio_url },
        { shouldPlay: true }
      );

      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
          setIsPlaying(false);
        }
      });
    } catch (err) {
      if (__DEV__) console.warn('[AppError] Error playing audio:', err);
      Alert.alert('오류', '오디오 재생에 실패했습니다.');
      setIsPlaying(false);
    }
  };

  // 피드백 저장
  const handleSaveFeedback = async () => {
    if (!practiceId || !feedbackText.trim()) {
      Alert.alert('알림', '피드백 내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);

    const { data, error: saveError } = await saveTeacherFeedback({
      practiceId,
      feedback: feedbackText.trim(),
    });

    setIsSaving(false);

    if (saveError) {
      Alert.alert('오류', getUserMessage(saveError));
      return;
    }

    setHasChanges(false);

    // 알림: 학생에게 피드백 알림 (fire-and-forget)
    if (practiceId) {
      notifyAction(NOTIFICATION_TYPES.TEACHER_FEEDBACK, practiceId).then((result) => {
        if (result.success && result.notification_log_id && !result.already_exists) {
          deliverNotification(result.notification_log_id);
        }
      });
    }

    Alert.alert('완료', '피드백이 저장되었습니다.');

    // 기존 피드백 업데이트
    if (practice && data) {
      setPractice({
        ...practice,
        teacher_feedback: {
          id: data.id,
          feedback: feedbackText.trim(),
          created_at: new Date().toISOString(),
        },
      });
    }
  };

  // 시간 포맷
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>불러오는 중...</Text>
      </View>
    );
  }

  if (error || !practice) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.ERROR} />
        <Text style={styles.errorText}>{error || '연습 기록을 찾을 수 없습니다.'}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  const aiFeedback = practice.feedback;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* 학생 정보 */}
        <View style={styles.studentInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={COLORS.PRIMARY} />
          </View>
          <View style={styles.studentDetails}>
            <Text style={styles.studentName}>{practice.student.name}</Text>
            <Text style={styles.studentEmail}>{practice.student.email}</Text>
          </View>
        </View>

        {/* 연습 정보 */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>토픽</Text>
            <Text style={styles.metaValue}>{practice.topic_name_ko}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>연습 일시</Text>
            <Text style={styles.metaValue}>{formatDate(practice.created_at)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>녹음 시간</Text>
            <Text style={styles.metaValue}>{formatDuration(practice.duration)}</Text>
          </View>
        </View>

        {/* 점수 섹션 */}
        <View style={styles.scoreSection}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>점수</Text>
            <Text style={styles.scoreValue}>{practice.score ?? '-'}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>재현율</Text>
            <Text style={styles.scoreValue}>
              {practice.reproduction_rate ? `${practice.reproduction_rate}%` : '-'}
            </Text>
          </View>
        </View>

        {/* 녹음 재생 */}
        {practice.audio_url && (
          <Pressable
            style={[styles.audioButton, isPlaying && styles.audioButtonPlaying]}
            onPress={handleToggleAudio}
          >
            <Ionicons
              name={isPlaying ? 'stop-circle' : 'play-circle'}
              size={24}
              color={isPlaying ? COLORS.ERROR : COLORS.PRIMARY}
            />
            <Text style={[styles.audioButtonText, isPlaying && styles.audioButtonTextPlaying]}>
              {isPlaying ? '재생 중지' : '학생 녹음 듣기'}
            </Text>
          </Pressable>
        )}

        {/* 질문 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>질문</Text>
          <View style={styles.questionBox}>
            <Text style={styles.questionText}>{practice.question_text}</Text>
          </View>
        </View>

        {/* 학생 답변 (STT 결과) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>학생 답변 (음성 인식 결과)</Text>
          <View style={styles.transcriptionBox}>
            <Text style={styles.transcriptionText}>
              {practice.transcription || '음성 인식 결과가 없습니다.'}
            </Text>
          </View>
        </View>

        {/* 원본 스크립트 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>원본 스크립트</Text>
          <View style={styles.scriptBox}>
            <Text style={styles.scriptText}>{practice.script_content}</Text>
          </View>
        </View>

        {/* AI 피드백 */}
        {aiFeedback && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI 피드백</Text>
            <View style={styles.aiFeedbackBox}>
              <Text style={styles.feedbackSummary}>{aiFeedback.summary}</Text>

              {aiFeedback.missed_phrases && aiFeedback.missed_phrases.length > 0 && (
                <View style={styles.feedbackSection}>
                  <View style={styles.feedbackLabelRow}>
                    <Ionicons name="remove-circle-outline" size={16} color={COLORS.ERROR} />
                    <Text style={[styles.feedbackLabel, { color: COLORS.ERROR }]}>
                      빠뜨린 표현
                    </Text>
                  </View>
                  {aiFeedback.missed_phrases.map((phrase, i) => (
                    <Text key={i} style={styles.feedbackItem}>• {phrase}</Text>
                  ))}
                </View>
              )}

              {aiFeedback.suggestions && aiFeedback.suggestions.length > 0 && (
                <View style={styles.feedbackSection}>
                  <View style={styles.feedbackLabelRow}>
                    <Ionicons name="bulb-outline" size={16} color={COLORS.PRIMARY} />
                    <Text style={[styles.feedbackLabel, { color: COLORS.PRIMARY }]}>
                      개선 제안
                    </Text>
                  </View>
                  {aiFeedback.suggestions.map((suggestion, i) => (
                    <Text key={i} style={styles.feedbackItem}>• {suggestion}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* 강사 피드백 작성 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            강사 피드백 {practice.teacher_feedback ? '(작성됨)' : '(미작성)'}
          </Text>
          <View style={styles.teacherFeedbackBox}>
            <TextInput
              style={styles.feedbackInput}
              placeholder="학생에게 피드백을 작성해주세요..."
              placeholderTextColor={COLORS.GRAY_400}
              value={feedbackText}
              onChangeText={(text) => {
                setFeedbackText(text);
                setHasChanges(true);
              }}
              multiline
              textAlignVertical="top"
            />
            <Pressable
              style={[
                styles.saveButton,
                (!hasChanges || isSaving) && styles.saveButtonDisabled,
              ]}
              onPress={handleSaveFeedback}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={COLORS.WHITE} />
                  <Text style={styles.saveButtonText}>피드백 저장</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  scrollView: {
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
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  studentEmail: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  metaSection: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  metaValue: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_PRIMARY,
  },
  scoreSection: {
    flexDirection: 'row',
    marginBottom: 16,
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
    fontSize: 32,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.PRIMARY,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY + '15',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  audioButtonPlaying: {
    backgroundColor: COLORS.ERROR + '15',
  },
  audioButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
  },
  audioButtonTextPlaying: {
    color: COLORS.ERROR,
  },
  section: {
    marginBottom: 16,
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
  aiFeedbackBox: {
    backgroundColor: COLORS.WARNING + '15',
    padding: 16,
    borderRadius: 16,
  },
  feedbackSummary: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
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
  teacherFeedbackBox: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  feedbackInput: {
    padding: 16,
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    minHeight: 120,
    lineHeight: 22,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    padding: 14,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.GRAY_400,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
});
