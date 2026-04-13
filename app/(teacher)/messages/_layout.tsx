import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';

export default function MessagesLayout() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceSecondary },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: 'Pretendard-Bold',
          fontSize: 18,
          color: colors.textPrimary,
        },
        headerBackTitle: '',
        headerTintColor: colors.textPrimary,
        contentStyle: { paddingBottom: insets.bottom },
      }}
    >
      <Stack.Screen name="index" options={{ title: '메시지' }} />
      <Stack.Screen name="compose" options={{ title: '메시지 보내기' }} />
    </Stack>
  );
}
