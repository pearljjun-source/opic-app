import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import type { TeacherStudentListItem } from '@/lib/types';

interface StudentCardProps {
  student: TeacherStudentListItem;
  onPress?: () => void;
  onAction?: () => void;
}

/**
 * StudentCard - 강사용 학생 카드 컴포넌트
 *
 * 기능:
 * - 학생 이름, 이메일 표시
 * - 스크립트 수, 연습 수 표시
 * - 마지막 연습 시간 표시
 * - 평균 점수, 재현율 표시
 */
export function StudentCard({ student, onPress, onAction }: StudentCardProps) {
  const colors = useThemeColors();

  const formatLastPractice = (lastPracticeAt: string | null): string => {
    if (!lastPracticeAt) {
      return '연습 기록 없음';
    }

    const date = new Date(lastPracticeAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '오늘';
    } else if (diffDays === 1) {
      return '어제';
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}주 전`;
    } else {
      const months = Math.floor(diffDays / 30);
      return `${months}개월 전`;
    }
  };

  const formatScore = (score: number | null): string => {
    if (score === null) return '-';
    return `${score}점`;
  };

  const formatRate = (rate: number | null): string => {
    if (rate === null) return '-';
    return `${rate}%`;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.surface, shadowColor: '#000000' },
        pressed && [styles.containerPressed, { backgroundColor: colors.surfaceSecondary }],
      ]}
      onPress={onPress}
    >
      {/* 상단: 이름과 마지막 연습 */}
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.textPrimary }]}>{student.name}</Text>
            {'pending_feedback_count' in student &&
              (student as TeacherStudentListItem).pending_feedback_count > 0 && (
              <View style={[styles.feedbackBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.feedbackBadgeText}>
                  {(student as TeacherStudentListItem).pending_feedback_count}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{student.email}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.lastPracticeContainer}>
            <Text style={[styles.lastPracticeLabel, { color: colors.textSecondary }]}>마지막 연습</Text>
            <Text style={[styles.lastPracticeValue, { color: colors.primary }]}>
              {formatLastPractice(student.last_practice_at)}
            </Text>
          </View>
          {onAction && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { backgroundColor: colors.borderLight },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onAction();
              }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color={colors.gray400} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 하단: 통계 */}
      <View style={[styles.statsContainer, { borderTopColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{student.scripts_count}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>스크립트</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{student.practices_count}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>연습</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatScore(student.avg_score)}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>평균점수</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatRate(student.avg_reproduction_rate)}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>재현율</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 16,
  },
  nameContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
  },
  feedbackBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackBadgeText: {
    fontSize: 11,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
  },
  email: {
    fontSize: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  lastPracticeContainer: {
    alignItems: 'flex-end',
  },
  actionButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginTop: -4,
    marginRight: -8,
  },
  lastPracticeLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  lastPracticeValue: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
});

export default StudentCard;
