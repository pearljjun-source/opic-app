import { useState, useRef, useCallback } from 'react';

/**
 * 녹음 경과 시간 타이머 훅
 * - start(): 0부터 매초 1씩 증가
 * - stop(): 타이머 정지 (현재 값 유지)
 * - reset(): 0으로 초기화
 * - seconds: 현재 경과 시간 (초)
 * - secondsRef: stale closure 방지용 (콜백에서 최신 값 접근)
 */
export function useRecordingTimer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  // ref 동기화
  secondsRef.current = seconds;

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(0);
    secondsRef.current = 0;
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        secondsRef.current = next;
        return next;
      });
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setSeconds(0);
    secondsRef.current = 0;
  }, [stop]);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { seconds, secondsRef, start, stop, reset, cleanup };
}
