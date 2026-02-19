import { View, ActivityIndicator, Platform } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useTheme';
import LandingPage from '@/components/LandingPage';

/**
 * 앱 시작 화면
 *
 * - 웹: 인증 상태 확정 후 미인증 사용자에게만 랜딩 페이지 표시.
 *   isLoading 또는 isAuthenticated 중에는 로딩 표시 (useAuth가 홈으로 리다이렉트).
 * - 네이티브: useAuth 훅이 인증 상태에 따라 자동으로 라우팅 처리
 */
export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  const colors = useThemeColors();

  if (Platform.OS === 'web') {
    // 인증 초기화 중이거나 이미 인증됨 → 로딩 표시 (useAuth 라우팅이 홈으로 이동)
    // LandingPage를 인증된 상태에서 렌더링하면 "로그인" 버튼 클릭 시 자동 로그인됨
    if (isLoading || isAuthenticated) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
          <ActivityIndicator size="large" color="#D4707F" />
        </View>
      );
    }
    // 미인증 확정 → 랜딩 페이지
    return <LandingPage />;
  }

  // 네이티브: 로딩 후 useAuth가 자동 리다이렉트
  return (
    <View className="flex-1 justify-center items-center bg-white dark:bg-neutral-900">
      {isLoading && <ActivityIndicator size="large" color={colors.primary} />}
    </View>
  );
}
