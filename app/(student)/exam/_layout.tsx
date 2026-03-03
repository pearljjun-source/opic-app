import { Stack } from 'expo-router';
import { useThemeColors } from '@/hooks/useTheme';

export default function ExamLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surfaceSecondary },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: 'Pretendard-Bold',
          fontSize: 20,
          color: colors.textPrimary,
        },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen name="mock-survey" options={{ title: '토픽 선택' }} />
      <Stack.Screen name="mock-assessment" options={{ title: '자기평가' }} />
      <Stack.Screen name="combo-list" options={{ title: '롤플레이 시나리오' }} />
      <Stack.Screen name="session" options={{ title: '시험 진행', headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="processing" options={{ title: '결과 처리', headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="result" options={{ title: '시험 결과' }} />
      <Stack.Screen name="history" options={{ title: '시험 기록' }} />
      <Stack.Screen name="[sessionId]" options={{ title: '결과 상세' }} />
    </Stack>
  );
}
