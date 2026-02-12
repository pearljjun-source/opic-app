import { Stack } from 'expo-router';

export default function ScriptLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/practice" />
      <Stack.Screen name="[id]/shadowing" />
      <Stack.Screen name="[id]/result" />
      <Stack.Screen name="practice/[practiceId]" />
    </Stack>
  );
}
