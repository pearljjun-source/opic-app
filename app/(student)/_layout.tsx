import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';
import { usePendingInvite } from '@/hooks/usePendingInvite';

export default function StudentLayout() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  // auth flow 완료 후 대기 중인 초대 코드 자동 사용
  usePendingInvite();

  const headerOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.surfaceSecondary },
    headerShadowVisible: false,
    headerTitleStyle: {
      fontFamily: 'Pretendard-Bold' as const,
      fontSize: 20,
      color: colors.textPrimary,
    },
  };

  const safeContentStyle = { paddingBottom: insets.bottom };

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="connect"
        options={{ ...headerOptions, title: '초대 코드 입력', contentStyle: safeContentStyle }}
      />
      <Stack.Screen
        name="topics"
        options={{ ...headerOptions, title: '내 토픽 설정', contentStyle: safeContentStyle }}
      />
      <Stack.Screen name="script" options={{ contentStyle: safeContentStyle }} />
      <Stack.Screen name="topic" options={{ contentStyle: safeContentStyle }} />
      <Stack.Screen name="exam" options={{ contentStyle: safeContentStyle }} />
      <Stack.Screen
        name="messages"
        options={{ ...headerOptions, title: '메시지', contentStyle: safeContentStyle }}
      />
    </Stack>
  );
}
