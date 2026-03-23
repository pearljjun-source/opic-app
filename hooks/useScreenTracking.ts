import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { track, EVENTS } from '@/lib/analytics';

/**
 * Expo Router 경로 변경 시 자동 Screen View 트래킹
 * app/_layout.tsx에서 한 번만 호출
 */
export function useScreenTracking(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      track(EVENTS.SCREEN_VIEW, { screen: pathname });
    }
  }, [pathname]);
}
