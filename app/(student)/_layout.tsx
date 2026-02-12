import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/lib/constants';

export default function StudentLayout() {
  const insets = useSafeAreaInsets();

  const headerOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: COLORS.BACKGROUND_SECONDARY },
    headerShadowVisible: false,
    headerTitleStyle: {
      fontFamily: 'Pretendard-Bold' as const,
      fontSize: 20,
      color: COLORS.TEXT_PRIMARY,
    },
  };

  const safeContentStyle = { paddingBottom: insets.bottom };

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="connect"
        options={{ ...headerOptions, title: '강사 연결', contentStyle: safeContentStyle }}
      />
      <Stack.Screen
        name="topics"
        options={{ ...headerOptions, title: '내 토픽 설정', contentStyle: safeContentStyle }}
      />
      <Stack.Screen name="script" options={{ contentStyle: safeContentStyle }} />
      <Stack.Screen name="topic" options={{ contentStyle: safeContentStyle }} />
    </Stack>
  );
}
