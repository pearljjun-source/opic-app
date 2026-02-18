import { View, Text, StyleSheet } from 'react-native';

import { useThemeColors } from '@/hooks/useTheme';

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
  const colors = useThemeColors();

  if (currentStreak <= 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.borderLight }]}>
        <Text style={[styles.inactiveText, { color: colors.textSecondary }]}>오늘 연습을 시작하세요</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.accentYellowBg }]}>
      <Text style={styles.fireEmoji}>🔥</Text>
      <Text style={[styles.streakText, { color: colors.gray800 }]}>
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
  fireEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  streakText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  streakCount: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
  },
  inactiveText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
});
