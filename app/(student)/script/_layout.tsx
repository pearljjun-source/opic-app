import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/lib/constants';

export default function ScriptLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '뒤로',
        headerTintColor: COLORS.PRIMARY,
        headerStyle: { backgroundColor: COLORS.BACKGROUND_SECONDARY },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: 'Pretendard-SemiBold',
          fontSize: 17,
          color: COLORS.TEXT_PRIMARY,
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
