import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/lib/constants';

export default function StudentLayout() {
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
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/assign-topics" />
      <Stack.Screen name="[id]/topic/[topicId]" />
      <Stack.Screen name="[id]/practice/[practiceId]" />
      <Stack.Screen name="script/select-topic" options={{ title: '토픽 선택' }} />
      <Stack.Screen name="script/select-question" options={{ title: '질문 선택' }} />
      <Stack.Screen name="script/new" options={{ title: '스크립트 작성' }} />
      <Stack.Screen name="script/[scriptId]" options={{ title: '스크립트 수정' }} />
    </Stack>
  );
}
