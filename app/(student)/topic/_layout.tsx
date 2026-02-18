import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';

export default function TopicLayout() {
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
      <Stack.Screen name="[topicId]" options={{ title: '토픽 상세' }} />
    </Stack>
  );
}
