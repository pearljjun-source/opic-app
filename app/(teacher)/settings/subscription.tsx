import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';

export default function SubscriptionScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="card-outline" size={56} color={COLORS.GRAY_300} />
      <Text style={styles.title}>구독 정보</Text>
      <Text style={styles.subtitle}>구독 관리 기능이 곧 제공됩니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
});
