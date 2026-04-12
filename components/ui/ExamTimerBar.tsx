import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/useTheme';
import { formatDuration } from '@/lib/helpers';

interface ExamTimerBarProps {
  /** 남은 시간 (초) */
  remaining: number;
  /** 전체 시간 (초) — 프로그레스 바 비율 계산용 */
  total: number;
  /** 경고 임계값 (초) — 이 값 이하면 빨간색 */
  warningThreshold?: number;
}

/**
 * 시험 녹음 타이머 — 프로그레스 바 + 카운트다운
 * 실제 OPIc 시험과 유사한 UI
 */
export function ExamTimerBar({ remaining, total, warningThreshold = 10 }: ExamTimerBarProps) {
  const colors = useThemeColors();
  const isWarning = remaining > 0 && remaining <= warningThreshold;
  const progress = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  const barColor = isWarning ? colors.error : colors.primary;
  const textColor = isWarning ? colors.error : colors.textSecondary;

  return (
    <View style={styles.container}>
      <View style={[styles.barBackground, { backgroundColor: colors.border }]}>
        <View style={[styles.barFill, { backgroundColor: barColor, width: `${progress}%` }]} />
      </View>
      <Text style={[
        styles.timeText,
        { color: textColor },
        isWarning && styles.timeWarning,
      ]}>
        {formatDuration(remaining)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  barBackground: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  timeText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    fontVariant: ['tabular-nums'],
  },
  timeWarning: {
    fontFamily: 'Pretendard-Bold',
  },
});
