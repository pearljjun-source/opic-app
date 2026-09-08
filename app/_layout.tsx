import '../global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { AuthProvider } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useWebNotifications } from '@/hooks/useWebNotifications';
import { loadThemePreference } from '@/hooks/useTheme';
import { Toast } from '@/components/ui/Toast';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { initSentry } from '@/lib/sentry';
import { initAnalytics } from '@/lib/analytics';
import { queryClient, initQueryClientBindings } from '@/lib/query';
import { useScreenTracking } from '@/hooks/useScreenTracking';

// 앱 시작 시 최우선 실행
initSentry();
initAnalytics();
// 네트워크 상태·포그라운드 복귀를 쿼리 캐시에 연결한다 (화면마다 하던 일을 한 곳에서)
initQueryClientBindings();

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...Ionicons.font,
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function NotificationSetup() {
  usePushNotifications();
  return null;
}

function WebNotificationSetup() {
  useWebNotifications();
  return null;
}

function ScreenTracker() {
  useScreenTracking();
  return null;
}

function RootLayoutNav() {
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    loadThemePreference().then((pref) => {
      setColorScheme(pref);
    });
  }, [setColorScheme]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {Platform.OS !== 'web' && <NotificationSetup />}
          {Platform.OS === 'web' && <WebNotificationSetup />}
          <ScreenTracker />
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <OfflineBanner />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="test" options={{ title: '컴포넌트 테스트' }} />
              <Stack.Screen name="test-screen-container" options={{ title: 'ScreenContainer 테스트' }} />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(admin)" />
              <Stack.Screen name="(teacher)" />
              <Stack.Screen name="(student)" />
              <Stack.Screen name="join" options={{ headerShown: false }} />
              <Stack.Screen name="terms" options={{ title: '이용약관', headerShown: Platform.OS !== 'web' }} />
              <Stack.Screen name="privacy" options={{ title: '개인정보 처리방침', headerShown: Platform.OS !== 'web' }} />
              <Stack.Screen name="refund" options={{ title: '환불 및 청약철회 정책', headerShown: Platform.OS !== 'web' }} />

              <Stack.Screen name="+not-found" />
            </Stack>
            <Toast />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
