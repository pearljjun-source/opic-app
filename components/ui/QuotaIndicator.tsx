import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useThemeColors } from '@/hooks/useTheme';

interface QuotaIndicatorProps {
  /** 표시 라벨 (e.g., "학생", "스크립트") */
  label: string;
  /** 사용량 */
  used: number;
  /** 한도 */
  limit: number;
  /** 업그레이드 경로 */
  upgradePath?: string;
}

export function QuotaIndicator({
  label,
  used,
  limit,
  upgradePath = '/(teacher)/manage/plan-select',
}: QuotaIndicatorProps) {
  const colors = useThemeColors();
  const remaining = Math.max(0, limit - used);
  const ratio = limit > 0 ? used / limit : 0;
  const isNearLimit = remaining <= 1;
  const isAtLimit = remaining <= 0;

  const barColor = isAtLimit ? colors.error : isNearLimit ? colors.warning : colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.count, { color: isAtLimit ? colors.error : colors.textPrimary }]}>
          {used}/{limit >= 9999 ? '∞' : limit}
        </Text>
      </View>
      <View style={[styles.barBg, { backgroundColor: colors.surfaceSecondary }]}>
        <View
          style={[styles.barFill, { backgroundColor: barColor, width: `${Math.min(100, ratio * 100)}%` }]}
        />
      </View>
      {isAtLimit && (
        <Pressable
          style={styles.upgradeRow}
          onPress={() => router.push(upgradePath as any)}
        >
          <Ionicons name="arrow-up-circle-outline" size={14} color={colors.primary} />
          <Text style={[styles.upgradeText, { color: colors.primary }]}>업그레이드</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
  count: {
    fontSize: 13,
    fontFamily: 'Pretendard-Bold',
  },
  barBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  upgradeText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
});
