import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useTheme';
import type { FluencyMetrics, ExamFluencyMetrics } from '@/lib/types';

// 답변 길이 등급 라벨/색상 매핑
const LENGTH_RATINGS = {
  too_short: { label: '매우 짧음', color: '#EF4444' },
  short: { label: '짧음', color: '#F59E0B' },
  adequate: { label: '적절', color: '#10B981' },
  long: { label: '충분', color: '#3B82F6' },
} as const;

interface FluencyMetricsCardProps {
  /** claude-feedback의 전체 유창성 메트릭 */
  metrics?: FluencyMetrics | null;
  /** claude-exam-evaluate의 문항별 간소화 메트릭 */
  examMetrics?: ExamFluencyMetrics | null;
}

export function FluencyMetricsCard({ metrics, examMetrics }: FluencyMetricsCardProps) {
  const colors = useThemeColors();

  // 둘 중 하나라도 있어야 렌더링
  const m = metrics || examMetrics;
  if (!m) return null;

  const rating = LENGTH_RATINGS[m.answer_length_rating] || LENGTH_RATINGS.short;
  const hasFull = metrics && 'transition_words' in metrics;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="pulse-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>유창성 분석</Text>
      </View>

      {/* 점수 바 */}
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>유창성 점수</Text>
        <View style={styles.scoreBarContainer}>
          <View style={[styles.scoreBarBg, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.scoreBarFill,
                {
                  backgroundColor: m.fluency_score >= 70 ? colors.success
                    : m.fluency_score >= 40 ? colors.warning
                    : colors.error,
                  width: `${Math.min(100, m.fluency_score)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>{m.fluency_score}</Text>
        </View>
      </View>

      {/* 메트릭 그리드 */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{m.word_count}</Text>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>단어 수</Text>
        </View>
        {hasFull && (
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{metrics.estimated_wpm}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>WPM</Text>
          </View>
        )}
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{m.filler_count}</Text>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>필러</Text>
        </View>
        <View style={styles.metricItem}>
          <View style={[styles.ratingBadge, { backgroundColor: rating.color + '20' }]}>
            <Text style={[styles.ratingText, { color: rating.color }]}>{rating.label}</Text>
          </View>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>발화량</Text>
        </View>
      </View>

      {/* 전환어 (full metrics만) */}
      {hasFull && metrics.transition_words.length > 0 && (
        <View style={styles.tagsSection}>
          <Text style={[styles.tagsSectionLabel, { color: colors.textSecondary }]}>
            사용된 연결 표현
          </Text>
          <View style={styles.tagsRow}>
            {metrics.transition_words.map((word, i) => (
              <View key={i} style={[styles.tag, { backgroundColor: colors.success + '15' }]}>
                <Text style={[styles.tagText, { color: colors.success }]}>{word}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 필러 워드 목록 (있을 때만) */}
      {hasFull && metrics.filler_words.length > 0 && (
        <View style={styles.tagsSection}>
          <Text style={[styles.tagsSectionLabel, { color: colors.textSecondary }]}>
            필러 표현
          </Text>
          <View style={styles.tagsRow}>
            {metrics.filler_words.slice(0, 5).map((word, i) => (
              <View key={i} style={[styles.tag, { backgroundColor: colors.warning + '15' }]}>
                <Text style={[styles.tagText, { color: colors.warning }]}>{word}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 코멘트 */}
      <Text style={[styles.comment, { color: colors.textSecondary }]}>
        {m.fluency_comment}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  scoreRow: {
    marginBottom: 14,
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 6,
  },
  scoreBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
    width: 28,
    textAlign: 'right',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  tagsSection: {
    marginBottom: 10,
  },
  tagsSectionLabel: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
  comment: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 20,
  },
});
