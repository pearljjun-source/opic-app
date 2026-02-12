import { Stack } from 'expo-router';

export default function TopicLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[topicId]" />
    </Stack>
  );
}
