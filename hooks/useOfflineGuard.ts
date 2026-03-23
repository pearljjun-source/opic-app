import { useEffect, useRef } from 'react';
import { useIsOnline } from './useNetworkStatus';

/**
 * 오프라인 가드 훅
 *
 * - 오프라인일 때 fetchFn 호출을 건너뜀 (불필요한 네트워크 에러 방지)
 * - 오프라인 → 온라인 복구 시 자동으로 fetchFn 재호출 (데이터 새로고침)
 *
 * 사용법:
 *   const { isOnline } = useOfflineGuard(fetchData);
 *   // fetchData가 오프라인 복구 시 자동 호출됨
 */
export function useOfflineGuard(fetchFn: () => void | Promise<void>) {
  const isOnline = useIsOnline();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      return;
    }

    // 오프라인 → 온라인 복구 시 자동 새로고침
    if (wasOffline.current) {
      wasOffline.current = false;
      fetchFn();
    }
  }, [isOnline, fetchFn]);

  return { isOnline };
}
