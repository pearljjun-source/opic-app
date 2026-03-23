import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsOnline } from '@/hooks/useNetworkStatus';

/**
 * 글로벌 오프라인 배너
 *
 * 앱 전체에서 네트워크 끊김 시 상단에 표시.
 * app/_layout.tsx의 RootLayoutNav에서 한 번만 렌더링.
 * 연결 복구 시 자동으로 사라짐.
 */
export function OfflineBanner() {
  const isOnline = useIsOnline();

  if (isOnline) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
      <Text style={styles.text}>오프라인 상태입니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#525252',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
});
