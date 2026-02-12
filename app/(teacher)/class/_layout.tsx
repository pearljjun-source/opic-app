import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ClassLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { paddingBottom: insets.bottom } }}>
      <Stack.Screen name="create" />
      <Stack.Screen name="[classId]/index" />
      <Stack.Screen name="[classId]/add-members" />
    </Stack>
  );
}
