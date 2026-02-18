import { View, Text, StyleSheet, Pressable } from 'react-native';

import { QUESTION_TYPE_LABELS } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';
import type { StudentPracticeListItem } from '@/lib/types';
import { ScoreBadge, DifficultyBadge } from '@/components/ui/Badge';

interface PracticeListItemProps {
  practice: StudentPracticeListItem;
  onPress?: () => void;
}

/**
 * PracticeListItem - 연습 기록 목록 아이템 컴포넌트
 *
 * 기능:
 * - 연습 일시, 점수, 재현율 표시
 * - 토픽/질문 정보 표시
 * - 강사 피드백 여부 표시
 * - 녹음 시간 표시
 */
export function PracticeListItem({ practice, onPress }: PracticeListItemProps) {
  const colors = useThemeColors();

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const questionTypeLabel =
    QUESTION_TYPE_LABELS[practice.question_type] || practice.question_type;

  const hasTeacherFeedback = practice.teacher_feedback_id !== null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.surface, shadowColor: '#000000' },
        pressed && [styles.containerPressed, { backgroundColor: colors.surfaceSecondary }],
      ]}
      onPress={onPress}
    >
      {/* 상단: 일시 + 점수 */}
      <View style={styles.header}>
        <View style={styles.dateContainer}>
          <Text style={[styles.date, { color: colors.textPrimary }]}>{formatDateTime(practice.created_at)}</Text>
          <Text style={[styles.duration, { color: colors.textSecondary }]}>
            {formatDuration(practice.duration)}
          </Text>
        </View>
        <View style={styles.scoreContainer}>
          {practice.score !== null && (
            <ScoreBadge score={practice.score} size="sm" />
          )}
          {practice.reproduction_rate !== null && (
            <View style={[styles.rateContainer, { backgroundColor: colors.secondaryLight }]}>
              <Text style={[styles.rateLabel, { color: colors.secondary }]}>재현</Text>
              <Text style={[styles.rateValue, { color: colors.secondary }]}>{practice.reproduction_rate}%</Text>
            </View>
          )}
        </View>
      </View>

      {/* 토픽/질문 정보 */}
      <View style={styles.questionInfo}>
        <View style={styles.topicRow}>
          {practice.topic_icon && (
            <Text style={styles.topicIcon}>{practice.topic_icon}</Text>
          )}
          <Text style={[styles.topicName, { color: colors.textPrimary }]}>{practice.topic_name_ko}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.questionType, { color: colors.primary }]}>{questionTypeLabel}</Text>
            <DifficultyBadge level={practice.difficulty} size="sm" />
          </View>
        </View>
        <Text style={[styles.questionText, { color: colors.textSecondary }]} numberOfLines={1}>
          {practice.question_text}
        </Text>
      </View>

      {/* 변환된 텍스트 미리보기 */}
      {practice.transcription && (
        <View style={[styles.transcriptionContainer, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.transcriptionLabel, { color: colors.textSecondary }]}>답변:</Text>
          <Text style={[styles.transcription, { color: colors.textPrimary }]} numberOfLines={2}>
            {practice.transcription}
          </Text>
        </View>
      )}

      {/* 하단: 피드백 상태 */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {hasTeacherFeedback ? (
          <View style={[styles.feedbackBadge, { backgroundColor: colors.secondaryLight }]}>
            <Text style={[styles.feedbackBadgeText, { color: colors.secondary }]}>피드백 작성됨</Text>
          </View>
        ) : (
          <View style={[styles.feedbackBadge, { backgroundColor: colors.borderLight }]}>
            <Text style={[styles.feedbackBadgeText, { color: colors.textSecondary }]}>
              피드백 대기
            </Text>
          </View>
        )}
        <Text style={[styles.viewDetail, { color: colors.primary }]}>상세보기 &gt;</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  containerPressed: {
    opacity: 0.9,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'column',
  },
  date: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 2,
  },
  duration: {
    fontSize: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rateLabel: {
    fontSize: 11,
  },
  rateValue: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
  },
  questionInfo: {
    marginBottom: 10,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  topicIcon: {
    fontSize: 14,
  },
  topicName: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    marginRight: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  questionType: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
  },
  questionText: {
    fontSize: 12,
    lineHeight: 16,
  },
  transcriptionContainer: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  transcriptionLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  transcription: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  feedbackBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  feedbackBadgeText: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
  },
  viewDetail: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
});

export default PracticeListItem;
