import { View, Text, StyleSheet, Pressable } from 'react-native';

import { COLORS, QUESTION_TYPE_LABELS } from '@/lib/constants';
import type { StudentScriptListItem } from '@/lib/types';
import { StatusBadge, DifficultyBadge } from '@/components/ui/Badge';

interface ScriptListItemProps {
  script: StudentScriptListItem;
  onPress?: () => void;
}

/**
 * ScriptListItem - 스크립트 목록 아이템 컴포넌트
 *
 * 기능:
 * - 토픽/질문 정보 표시
 * - 스크립트 상태 표시 (작성 중/완료)
 * - 연습 통계 표시 (연습 횟수, 최고 점수, 최고 재현율)
 */
export function ScriptListItem({ script, onPress }: ScriptListItemProps) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatLastPractice = (lastPracticeAt: string | null): string => {
    if (!lastPracticeAt) return '연습 없음';

    const date = new Date(lastPracticeAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    return formatDate(lastPracticeAt);
  };

  const questionTypeLabel = QUESTION_TYPE_LABELS[script.question_type] || script.question_type;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={onPress}
    >
      {/* 상단: 토픽 + 상태 */}
      <View style={styles.header}>
        <View style={styles.topicContainer}>
          {script.topic_icon && (
            <Text style={styles.topicIcon}>{script.topic_icon}</Text>
          )}
          <Text style={styles.topicName}>{script.topic_name_ko}</Text>
        </View>
        <StatusBadge status={script.status} size="sm" />
      </View>

      {/* 질문 정보 */}
      <View style={styles.questionContainer}>
        <View style={styles.questionMeta}>
          <Text style={styles.questionType}>{questionTypeLabel}</Text>
          <DifficultyBadge level={script.difficulty} size="sm" />
        </View>
        <Text style={styles.questionText} numberOfLines={2}>
          {script.question_text}
        </Text>
      </View>

      {/* 스크립트 미리보기 */}
      <Text style={styles.contentPreview} numberOfLines={2}>
        {script.content}
      </Text>

      {/* 하단: 연습 통계 */}
      <View style={styles.footer}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>연습</Text>
            <Text style={styles.statValue}>{script.practices_count}회</Text>
          </View>
          {script.best_score !== null && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>최고점수</Text>
              <Text style={[styles.statValue, styles.scoreValue]}>
                {script.best_score}점
              </Text>
            </View>
          )}
          {script.best_reproduction_rate !== null && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>최고재현율</Text>
              <Text style={[styles.statValue, styles.rateValue]}>
                {script.best_reproduction_rate}%
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.lastPractice}>
          {formatLastPractice(script.last_practice_at)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  containerPressed: {
    opacity: 0.9,
    backgroundColor: COLORS.GRAY_50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  topicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  topicName: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  questionContainer: {
    marginBottom: 10,
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  questionType: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    fontFamily: 'Pretendard-Medium',
  },
  questionText: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
  },
  contentPreview: {
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 20,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  statValue: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  scoreValue: {
    color: COLORS.PRIMARY,
  },
  rateValue: {
    color: COLORS.SECONDARY,
  },
  lastPractice: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
});

export default ScriptListItem;
