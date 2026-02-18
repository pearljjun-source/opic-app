import { View, Text, StyleSheet, Pressable } from 'react-native';

import { QUESTION_TYPE_LABELS } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';
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
  const colors = useThemeColors();

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
        { backgroundColor: colors.surface, shadowColor: '#000000' },
        pressed && [styles.containerPressed, { backgroundColor: colors.surfaceSecondary }],
      ]}
      onPress={onPress}
    >
      {/* 상단: 토픽 + 상태 */}
      <View style={styles.header}>
        <View style={styles.topicContainer}>
          {script.topic_icon && (
            <Text style={styles.topicIcon}>{script.topic_icon}</Text>
          )}
          <Text style={[styles.topicName, { color: colors.textPrimary }]}>{script.topic_name_ko}</Text>
        </View>
        <StatusBadge status={script.status} size="sm" />
      </View>

      {/* 질문 정보 */}
      <View style={styles.questionContainer}>
        <View style={styles.questionMeta}>
          <Text style={[styles.questionType, { color: colors.primary }]}>{questionTypeLabel}</Text>
          <DifficultyBadge level={script.difficulty} size="sm" />
        </View>
        <Text style={[styles.questionText, { color: colors.textSecondary }]} numberOfLines={2}>
          {script.question_text}
        </Text>
      </View>

      {/* 스크립트 미리보기 */}
      <Text style={[styles.contentPreview, { color: colors.textPrimary, borderTopColor: colors.border }]} numberOfLines={2}>
        {script.content}
      </Text>

      {/* 하단: 연습 통계 */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>연습</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{script.practices_count}회</Text>
          </View>
          {script.best_score !== null && (
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>최고점수</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {script.best_score}점
              </Text>
            </View>
          )}
          {script.best_reproduction_rate !== null && (
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>최고재현율</Text>
              <Text style={[styles.statValue, { color: colors.secondary }]}>
                {script.best_reproduction_rate}%
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.lastPractice, { color: colors.textSecondary }]}>
          {formatLastPractice(script.last_practice_at)}
        </Text>
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
    fontFamily: 'Pretendard-Medium',
  },
  questionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  contentPreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
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
  },
  statValue: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
  },
  lastPractice: {
    fontSize: 12,
  },
});

export default ScriptListItem;
