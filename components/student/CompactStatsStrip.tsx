import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { estimateOpicLevel, getOpicGradeColor, getTrendDirection } from '@/lib/helpers';
import { ProgressSummaryCard } from './ProgressSummaryCard';
import { LearningStatsCard } from './LearningStatsCard';
import type { StudentPracticeStats } from '@/lib/types';

// Android LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CompactStatsStripProps {
  stats: StudentPracticeStats;
  currentStreak: number;
}

/**
 * CompactStatsStrip - 학생 대시보드 컴팩트 통계 스트립
 *
 * 접힌 상태: 1줄 가로 배치 — OPIc 등급 | 평균 점수(트렌드) | 스트릭 | ▼
 * 펼친 상태: 같은 카드 안에서 ProgressSummaryCard + LearningStatsCard 드롭다운
 */
export function CompactStatsStrip({ stats, currentStreak }: CompactStatsStripProps) {
  const colors = useThemeColors();
  const [isExpanded, setIsExpanded] = useState(false);

  const estimated = estimateOpicLevel(stats.avg_score);
  const gradeColor = getOpicGradeColor(estimated.grade);
  const scoreTrend = getTrendDirection(stats.avg_score, stats.prev_avg_score);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const formatScore = (score: number | null): string => {
    if (score === null) return '-';
    return `${Math.round(score)}점`;
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, shadowColor: '#000000' },
          pressed && styles.cardPressed,
        ]}
        onPress={toggleExpand}
      >
        {/* 접힌 상태: 가로 1줄 요약 */}
        <View style={styles.strip}>
          {/* OPIc 등급 */}
          <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
            <Text style={styles.gradeText}>{estimated.grade}</Text>
          </View>

          {/* 평균 점수 + 트렌드 */}
          <View style={styles.scoreSection}>
            <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>{formatScore(stats.avg_score)}</Text>
            {scoreTrend === 'up' && (
              <Ionicons name="arrow-up" size={12} color={colors.success} />
            )}
            {scoreTrend === 'down' && (
              <Ionicons name="arrow-down" size={12} color={colors.error} />
            )}
          </View>

          {/* 구분선 */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* 스트릭 */}
          <View style={styles.streakSection}>
            {currentStreak > 0 ? (
              <>
                <Text style={styles.fireEmoji}>🔥</Text>
                <Text style={[styles.streakText, { color: colors.gray800 }]}>{currentStreak}일</Text>
              </>
            ) : (
              <Text style={[styles.noStreakText, { color: colors.textSecondary }]}>오늘 시작!</Text>
            )}
          </View>

          {/* 펼치기/접기 아이콘 */}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </View>

        {/* 펼친 상태: 같은 카드 안에 상세 정보 */}
        {isExpanded && (
          <View style={[styles.expandedContent, { borderTopColor: colors.borderLight }]}>
            <ProgressSummaryCard stats={stats} embedded />
            <LearningStatsCard stats={stats} embedded />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  // 접힌 상태 가로 1줄
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gradeText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 12,
  },
  scoreValue: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 12,
  },
  streakSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fireEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  streakText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  noStreakText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  // 펼친 상태
  expandedContent: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 4,
  },
});
