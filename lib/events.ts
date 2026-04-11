/**
 * 경량 이벤트 버스 — 화면 간 데이터 변경 알림
 *
 * 웹/모바일 모두 동작 (JS 메모리 기반, 플랫폼 무관)
 *
 * 사용법:
 *   emit('script-changed')              // 변경 알림 발행
 *   const off = on('script-changed', fn) // 구독
 *   off()                                // 구독 해제
 */

type Callback = () => void;

const listeners: Record<string, Callback[]> = {};

/** 이벤트 발행 — 해당 이벤트를 구독 중인 모든 콜백 실행 */
export function emit(event: string) {
  listeners[event]?.forEach((cb) => cb());
}

/** 이벤트 구독 — 해제 함수 반환 (useEffect cleanup에 사용) */
export function on(event: string, callback: Callback): () => void {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);

  return () => {
    listeners[event] = listeners[event].filter((cb) => cb !== callback);
  };
}
