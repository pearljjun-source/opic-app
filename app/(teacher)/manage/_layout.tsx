import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';

export default function SettingsLayout() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '설정',
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
      <Stack.Screen name="academy-info" options={{ title: '학원 정보' }} />
      <Stack.Screen name="teacher-management" options={{ title: '강사 관리' }} />
      <Stack.Screen name="subscription" options={{ title: '구독 정보' }} />
      <Stack.Screen name="plan-select" options={{ title: '플랜 선택' }} />
    </Stack>
  );
}
