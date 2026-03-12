import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';
import HomeButton from '@/components/ui/HomeButton';

export default function ClassLayout() {
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
        headerRight: () => <HomeButton />,
        contentStyle: { paddingBottom: insets.bottom },
      }}
    >
      <Stack.Screen name="create" options={{ title: '반 만들기' }} />
      <Stack.Screen name="[classId]/index" options={{ title: '반 상세' }} />
      <Stack.Screen name="[classId]/add-members" options={{ title: '멤버 추가' }} />
    </Stack>
  );
}
