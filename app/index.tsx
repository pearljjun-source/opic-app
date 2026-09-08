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
/**
 * 정적 빌드(프리렌더) 중인가.
 *
 * Node 에서 화면을 미리 그려 HTML 을 만드는 동안에는 window 가 없다.
 * 브라우저에서는 항상 false 다.
 */
const isPrerender = Platform.OS === 'web' && typeof window === 'undefined';

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  const colors = useThemeColors();

  if (Platform.OS === 'web') {
    // 빌드 시점(정적 프리렌더)에는 세션이라는 것이 없다. 여기서 스피너를 내보내면
    // 서버가 주는 첫 페이지가 영원히 빈 화면이 되고, 자바스크립트를 돌리지 않는
    // 쪽 — 결제대행 심사 크롤러, 검색엔진, 링크 미리보기 — 은 그것만 본다.
    // 실제로 심사가 "사업자 정보가 사이트에 명시되어 있지 않습니다" 로 반려한
    // 이유가 이것이다. 정보는 푸터에 있었지만 HTML 에는 없었다.
    //
    // 프리렌더에서 옳은 답은 랜딩이다. 로그인한 사람에게 보일 화면이 아니라,
    // "아직 아무도 아닌 방문자" 에게 보일 화면을 미리 만들어두는 것이다.
    // 브라우저에서 다시 그릴 때 세션이 있으면 useAuth 가 홈으로 보낸다.
    if (isPrerender) {
      return <LandingPage />;
    }

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
