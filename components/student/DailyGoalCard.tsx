import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import type { DailyProgress } from '@/services/practices';

interface DailyGoalCardProps {
  progress: DailyProgress;
  currentStreak: number;
  onChangeGoal: (newTarget: number) => void;
}

const GOAL_OPTIONS = [1, 2, 3, 5, 7, 10];

export function DailyGoalCard({ progress, currentStreak, onChangeGoal }: DailyGoalCardProps) {
  const colors = useThemeColors();
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const { daily_target, today_count, completed } = progress;
  const progressRatio = Math.min(1, today_count / daily_target);

  // 원형 프로그레스 대신 단순 도트 표시
  const dots = Array.from({ length: daily_target }, (_, i) => i < today_count);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>오늘의 목표</Text>
          {currentStreak > 0 && (
            <View style={[styles.streakBadge, { backgroundColor: colors.accentYellowBg }]}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={[styles.streakText, { color: colors.gray800 }]}>{currentStreak}일</Text>
            </View>
          )}
        </View>
        <Pressable onPress={() => setShowGoalPicker(!showGoalPicker)} hitSlop={8}>
          <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* 진행 상태 */}
      <View style={styles.progressSection}>
        <View style={styles.countRow}>
          <Text style={[styles.countCurrent, { color: completed ? colors.success : colors.primary }]}>
            {today_count}
          </Text>
          <Text style={[styles.countSeparator, { color: colors.textSecondary }]}>/</Text>
          <Text style={[styles.countTarget, { color: colors.textSecondary }]}>{daily_target}</Text>
        </View>

        {completed ? (
          <View style={[styles.completedBadge, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.completedText, { color: colors.success }]}>달성 완료!</Text>
          </View>
        ) : (
          <Text style={[styles.remainingText, { color: colors.textSecondary }]}>
            {daily_target - today_count}회 남음
          </Text>
        )}
      </View>

      {/* 도트 프로그레스 */}
      {daily_target <= 10 && (
        <View style={styles.dotsRow}>
          {dots.map((filled, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: filled
                    ? (completed ? colors.success : colors.primary)
                    : colors.border,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* 프로그레스 바 (10개 초과 시) */}
      {daily_target > 10 && (
        <View style={[styles.barBg, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.barFill,
              {
                backgroundColor: completed ? colors.success : colors.primary,
                width: `${progressRatio * 100}%`,
              },
            ]}
          />
        </View>
      )}

      {/* 목표 변경 피커 */}
      {showGoalPicker && (
        <View style={[styles.pickerContainer, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>일일 목표 변경</Text>
          <View style={styles.pickerOptions}>
            {GOAL_OPTIONS.map((n) => (
              <Pressable
                key={n}
                style={[
                  styles.pickerOption,
                  {
                    backgroundColor: n === daily_target ? colors.primary : colors.borderLight,
                  },
                ]}
                onPress={() => {
                  onChangeGoal(n);
                  setShowGoalPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    { color: n === daily_target ? '#FFFFFF' : colors.textPrimary },
                  ]}
                >
                  {n}회
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Bold',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  countCurrent: {
    fontSize: 32,
    fontFamily: 'Pretendard-Bold',
  },
  countSeparator: {
    fontSize: 20,
    fontFamily: 'Pretendard-Regular',
    marginHorizontal: 2,
  },
  countTarget: {
    fontSize: 20,
    fontFamily: 'Pretendard-Medium',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedText: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  remainingText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  pickerContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  pickerLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 8,
  },
  pickerOptions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pickerOptionText: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
});
