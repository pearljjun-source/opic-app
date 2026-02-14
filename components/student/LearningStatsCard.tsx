import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getTrendDirection } from '@/lib/helpers';
import type { StudentPracticeStats, TrendDirection } from '@/lib/types';

interface LearningStatsCardProps {
  stats: StudentPracticeStats;
  /** 부모 컨테이너 내부에서 사용 시 외부 여백/그림자 제거 */
  embedded?: boolean;
}

function TrendArrow({ direction }: { direction: TrendDirection }) {
  if (direction === 'up') {
    return <Ionicons name="arrow-up" size={12} color={COLORS.SUCCESS} />;
  }
  if (direction === 'down') {
    return <Ionicons name="arrow-down" size={12} color={COLORS.ERROR} />;
  }
  return null;
}

/**
 * LearningStatsCard - 학생 학습 통계 카드
 *
 * 4개 지표: 총 연습, 평균 점수(트렌드), 재현율(트렌드), 이번 주
 */
export function LearningStatsCard({ stats, embedded }: LearningStatsCardProps) {
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
    <View style={[styles.container, embedded && styles.embedded]}>
      <Text style={styles.title}>학습 통계</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total_practices}</Text>
          <Text style={styles.statLabel}>총 연습</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={styles.trendRow}>
            <Text style={styles.statValue}>{formatScore(stats.avg_score)}</Text>
            <TrendArrow direction={scoreTrend} />
          </View>
          <Text style={styles.statLabel}>평균 점수</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={styles.trendRow}>
            <Text style={styles.statValue}>{formatRate(stats.avg_reproduction_rate)}</Text>
            <TrendArrow direction={rateTrend} />
          </View>
          <Text style={styles.statLabel}>재현율</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.this_week_practices}</Text>
          <Text style={styles.statLabel}>이번 주</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: COLORS.BLACK,
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
    color: COLORS.TEXT_PRIMARY,
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
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.GRAY_100,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
