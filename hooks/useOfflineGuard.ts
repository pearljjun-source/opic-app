import { useEffect, useRef } from 'react';
import { useIsOnline } from './useNetworkStatus';

/**
 * 오프라인 가드 훅
 *
 * ⚠️ **이전 대기 중인 화면들만 쓴다. 새 화면에는 쓰지 않는다.**
 *
 * 이 훅이 하던 일 — "오프라인이면 건너뛰고 복구되면 다시 부른다" — 은
 * `lib/query.ts` 의 `onlineManager` 연결이 대신한다. useQuery 를 쓰는 화면은
 * 아무것도 하지 않아도 같은 동작을 얻는다.
 *
 * 그런데도 이 파일이 남아있는 이유는, 아직 useState + useEffect 로 직접 조회하는
 * 화면이 있고 그 화면들에게는 이것이 **유일한** 오프라인 복구 수단이기 때문이다.
 * 지금 지우면 기능이 사라진다.
 *
 * 화면을 useQuery 로 옮길 때 이 훅 호출도 **함께 지운다.** 마지막 호출이
 * 사라지면 이 파일도 지운다.
 *
 * 남은 사용처: (teacher) 홈·반 목록·초대, (admin) 홈
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
