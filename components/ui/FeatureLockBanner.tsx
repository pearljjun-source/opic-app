import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useThemeColors } from '@/hooks/useTheme';

interface FeatureLockBannerProps {
  /** 잠금된 기능 설명 (e.g., "AI 피드백", "TTS 발음 듣기") */
  feature: string;
  /** 업그레이드 경로 (기본: 강사 플랜 선택) */
  upgradePath?: string;
  /** 컴팩트 모드 (한 줄) */
  compact?: boolean;
}

export function FeatureLockBanner({
  feature,
  upgradePath = '/(teacher)/manage/plan-select',
  compact = false,
}: FeatureLockBannerProps) {
  const colors = useThemeColors();

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.accentYellowBg }]}>
        <Ionicons name="lock-closed" size={14} color={colors.warning} />
        <Text style={[styles.compactText, { color: colors.warning }]}>
          {feature} — 유료 플랜 필요
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.accentYellowBg, borderColor: colors.warning }]}>
      <View style={styles.row}>
        <Ionicons name="lock-closed" size={18} color={colors.warning} />
        <View style={styles.textArea}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {feature} 기능이 잠겨 있습니다
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            플랜을 업그레이드하면 사용할 수 있습니다.
          </Text>
        </View>
      </View>
      <Pressable
        style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
        onPress={() => router.push(upgradePath as any)}
      >
        <Text style={styles.upgradeBtnText}>업그레이드</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  textArea: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  description: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  upgradeBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  compactText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
});
