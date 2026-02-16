import { Stack } from 'expo-router';

import { RoleGuard } from '@/components/auth/RoleGuard';

export default function AdminLayout() {
  return (
    <RoleGuard allowedPlatformRoles={['super_admin']}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="user" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="academy" />
      </Stack>
    </RoleGuard>
  );
}
