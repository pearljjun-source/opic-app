import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '@/lib/constants';

interface StreakBadgeProps {
  currentStreak: number;
}

/**
 * StreakBadge - 연습 스트릭 뱃지
 *
 * - streak > 0: "N일 연속 연습 중!" (불꽃 아이콘)
 * - streak === 0: "오늘 연습을 시작하세요"
 */
export function StreakBadge({ currentStreak }: StreakBadgeProps) {
  if (currentStreak <= 0) {
    return (
      <View style={[styles.container, styles.inactiveContainer]}>
        <Text style={styles.inactiveText}>오늘 연습을 시작하세요</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.activeContainer]}>
      <Text style={styles.fireEmoji}>🔥</Text>
      <Text style={styles.streakText}>
        <Text style={styles.streakCount}>{currentStreak}</Text>일 연속 연습 중!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeContainer: {
    backgroundColor: '#FEF3C7',
  },
  inactiveContainer: {
    backgroundColor: COLORS.GRAY_100,
  },
  fireEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  streakText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.GRAY_800,
  },
  streakCount: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
  },
  inactiveText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
  },
});
