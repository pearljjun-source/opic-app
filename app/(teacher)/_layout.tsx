import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useThemeColors } from '@/hooks/useTheme';

export default function TeacherLayout() {
  const colors = useThemeColors();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="student" />
      <Stack.Screen name="class" />
      <Stack.Screen name="manage" />
      <Stack.Screen name="exam" />
      <Stack.Screen name="messages" />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: true,
          title: '알림',
          headerStyle: { backgroundColor: colors.surfaceSecondary },
          headerTitleStyle: {
            fontFamily: 'Pretendard-Bold',
            fontSize: 18,
            color: colors.textPrimary,
          },
          headerShadowVisible: false,
          headerBackTitle: '',
          headerTintColor: colors.textPrimary,
        }}
      />
    </Stack>
  );
}

