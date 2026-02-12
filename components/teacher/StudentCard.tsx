import { View, Text, StyleSheet, Pressable } from 'react-native';

import { COLORS } from '@/lib/constants';
import type { TeacherStudentListItem } from '@/lib/types';

interface StudentCardProps {
  student: TeacherStudentListItem;
  onPress?: () => void;
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
export function StudentCard({ student, onPress }: StudentCardProps) {
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
        pressed && styles.containerPressed,
      ]}
      onPress={onPress}
    >
      {/* 상단: 이름과 마지막 연습 */}
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{student.name}</Text>
          <Text style={styles.email}>{student.email}</Text>
        </View>
        <View style={styles.lastPracticeContainer}>
          <Text style={styles.lastPracticeLabel}>마지막 연습</Text>
          <Text style={styles.lastPracticeValue}>
            {formatLastPractice(student.last_practice_at)}
          </Text>
        </View>
      </View>

      {/* 하단: 통계 */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{student.scripts_count}</Text>
          <Text style={styles.statLabel}>스크립트</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{student.practices_count}</Text>
          <Text style={styles.statLabel}>연습</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatScore(student.avg_score)}</Text>
          <Text style={styles.statLabel}>평균점수</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatRate(student.avg_reproduction_rate)}</Text>
          <Text style={styles.statLabel}>재현율</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
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
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  lastPracticeContainer: {
    alignItems: 'flex-end',
  },
  lastPracticeLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 2,
  },
  lastPracticeValue: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.PRIMARY,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.BORDER,
  },
});

export default StudentCard;
