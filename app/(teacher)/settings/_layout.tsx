import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/lib/constants';

export default function SettingsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '설정',
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
      <Stack.Screen name="academy-info" options={{ title: '학원 정보' }} />
      <Stack.Screen name="teacher-management" options={{ title: '강사 관리' }} />
      <Stack.Screen name="subscription" options={{ title: '구독 정보' }} />
    </Stack>
  );
}
