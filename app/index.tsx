import { View, ActivityIndicator, Platform } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import LandingPage from '@/components/LandingPage';

/**
 * 앱 시작 화면
 *
 * - 웹: 랜딩 페이지 표시 (미인증 시), 인증 시 useAuth가 대시보드로 리다이렉트
 * - 네이티브: useAuth 훅이 인증 상태에 따라 자동으로 라우팅 처리
 */
export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();

  // 웹: 미인증 사용자에게 랜딩 페이지 표시
  if (Platform.OS === 'web' && !isAuthenticated) {
    return <LandingPage />;
  }

  // 네이티브 또는 웹 인증 사용자: 로딩 후 useAuth가 자동 리다이렉트
  return (
    <View className="flex-1 justify-center items-center bg-white">
      {isLoading && <ActivityIndicator size="large" color={COLORS.PRIMARY} />}
    </View>
  );
}
