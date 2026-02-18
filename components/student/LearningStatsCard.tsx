import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getTrendDirection } from '@/lib/helpers';
import type { StudentPracticeStats, TrendDirection } from '@/lib/types';

interface LearningStatsCardProps {
  stats: StudentPracticeStats;
  /** 부모 컨테이너 내부에서 사용 시 외부 여백/그림자 제거 */
  embedded?: boolean;
}

function TrendArrow({ direction }: { direction: TrendDirection }) {
  const colors = useThemeColors();
  if (direction === 'up') {
    return <Ionicons name="arrow-up" size={12} color={colors.success} />;
  }
  if (direction === 'down') {
    return <Ionicons name="arrow-down" size={12} color={colors.error} />;
  }
  return null;
}

/**
 * LearningStatsCard - 학생 학습 통계 카드
 *
 * 4개 지표: 총 연습, 평균 점수(트렌드), 재현율(트렌드), 이번 주
 */
export function LearningStatsCard({ stats, embedded }: LearningStatsCardProps) {
  const colors = useThemeColors();

  const scoreTrend = getTrendDirection(stats.avg_score, stats.prev_avg_score);
  const rateTrend = getTrendDirection(
    stats.avg_reproduction_rate,
    stats.prev_avg_reproduction_rate
  );

  const formatScore = (score: number | null): string => {
    if (score === null) return '-';
    return `${Math.round(score)}점`;
  };

  const formatRate = (rate: number | null): string => {
    if (rate === null) return '-';
    return `${Math.round(rate)}%`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }, embedded && styles.embedded]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>학습 통계</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.total_practices}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>총 연습</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.statItem}>
          <View style={styles.trendRow}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatScore(stats.avg_score)}</Text>
            <TrendArrow direction={scoreTrend} />
          </View>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>평균 점수</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.statItem}>
          <View style={styles.trendRow}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatRate(stats.avg_reproduction_rate)}</Text>
            <TrendArrow direction={rateTrend} />
          </View>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>재현율</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.this_week_practices}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>이번 주</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  embedded: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
