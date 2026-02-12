import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/lib/constants';

export default function TopicLayout() {
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
      <Stack.Screen name="[topicId]" options={{ title: '토픽 상세' }} />
    </Stack>
  );
}
