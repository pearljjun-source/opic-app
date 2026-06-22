import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useTheme';
import { formatDuration } from '@/lib/helpers';

interface RecordingTimeAssessmentProps {
  durationSeconds: number;
}

type TimeRating = 'too_short' | 'short' | 'good' | 'long';

function getTimeRating(seconds: number): TimeRating {
  if (seconds < 15) return 'too_short';
  if (seconds < 30) return 'short';
  if (seconds <= 120) return 'good';
  return 'long';
}

const RATING_CONFIG: Record<TimeRating, { label: string; message: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  too_short: {
    label: '매우 짧음',
    message: 'OPIc에서는 최소 30초 이상 답변해야 좋은 점수를 받을 수 있습니다. 내용을 더 풍부하게 말해보세요.',
    icon: 'alert-circle-outline',
    color: '#EF4444',
  },
  short: {
    label: '짧음',
    message: '답변이 다소 짧습니다. 예시나 경험을 추가하면 발화량을 늘릴 수 있습니다.',
    icon: 'warning-outline',
    color: '#F59E0B',
  },
  good: {
    label: '적절',
    message: '좋은 답변 길이입니다! OPIc에서 적절한 발화량을 유지하고 있습니다.',
    icon: 'checkmark-circle-outline',
    color: '#10B981',
  },
  long: {
    label: '충분',
    message: '충분한 답변 길이입니다. 핵심 내용을 놓치지 않았는지 확인해보세요.',
    icon: 'checkmark-circle-outline',
    color: '#3B82F6',
  },
};

export function RecordingTimeAssessment({ durationSeconds }: RecordingTimeAssessmentProps) {
  const colors = useThemeColors();
  const rating = getTimeRating(durationSeconds);
  const config = RATING_CONFIG[rating];

  // 프로그레스 바: 90초를 100%로 간주
  const progress = Math.min(1, durationSeconds / 90);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>답변 시간</Text>
      </View>

      <View style={styles.timeRow}>
        <Text style={[styles.duration, { color: colors.textPrimary }]}>{formatDuration(durationSeconds)}</Text>
        <View style={[styles.ratingBadge, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon} size={14} color={config.color} />
          <Text style={[styles.ratingText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      {/* 프로그레스 바 */}
      <View style={styles.barContainer}>
        <View style={[styles.barBg, { backgroundColor: colors.border }]}>
          <View style={[styles.barFill, { backgroundColor: config.color, width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.barLabels}>
          <Text style={[styles.barLabel, { color: colors.textSecondary }]}>0s</Text>
          <Text style={[styles.barLabel, { color: colors.textSecondary }]}>30s</Text>
          <Text style={[styles.barLabel, { color: colors.textSecondary }]}>60s</Text>
          <Text style={[styles.barLabel, { color: colors.textSecondary }]}>90s</Text>
        </View>
      </View>

      <Text style={[styles.message, { color: colors.textSecondary }]}>{config.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  duration: {
    fontSize: 28,
    fontFamily: 'Pretendard-Bold',
    fontVariant: ['tabular-nums'],
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  barContainer: {
    marginBottom: 12,
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
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Pretendard-Regular',
  },
  message: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 20,
  },
});
