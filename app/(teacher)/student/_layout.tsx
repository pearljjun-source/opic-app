import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';

export default function StudentLayout() {
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
