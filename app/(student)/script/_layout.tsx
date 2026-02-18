import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';

export default function ScriptLayout() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '뒤로',
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surfaceSecondary },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: 'Pretendard-SemiBold',
          fontSize: 17,
          color: colors.textPrimary,
        },
        contentStyle: { paddingBottom: insets.bottom },
      }}
    >
      <Stack.Screen name="[id]/index" options={{ title: '스크립트' }} />
      <Stack.Screen name="[id]/practice" options={{ title: '연습하기' }} />
      <Stack.Screen name="[id]/shadowing" options={{ title: '셰도잉' }} />
      <Stack.Screen name="[id]/result" options={{ title: '연습 결과' }} />
      <Stack.Screen name="practice/[practiceId]" options={{ title: '연습 상세' }} />
    </Stack>
  );
}
