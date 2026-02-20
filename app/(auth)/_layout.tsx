import { Stack } from 'expo-router';
import { Platform, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function AuthLayout() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';

  return (
    <Stack
      screenOptions={{
        headerShown: isWeb,
        headerTransparent: true,
        headerTitle: '',
        headerShadowVisible: false,
        headerLeft: isWeb
          ? () => (
              <Pressable
                onPress={() => router.replace('/')}
                style={{ marginLeft: 12 }}
              >
                <Image
                  source={require('@/assets/images/speaky-icon.png')}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                />
              </Pressable>
            )
          : undefined,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="create-academy" />
    </Stack>
  );
}
