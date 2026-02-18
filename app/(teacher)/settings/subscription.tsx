import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';

export default function SubscriptionScreen() {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <Ionicons name="card-outline" size={56} color={colors.gray300} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>구독 정보</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>구독 관리 기능이 곧 제공됩니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
