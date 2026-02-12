import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import type { TimerId } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export type AppStateType = 'active' | 'background' | 'inactive';

export interface UseAppStateOptions {
  onForeground?: () => void;
  onBackground?: () => void;
  onChange?: (state: AppStateType) => void;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useAppState(options?: UseAppStateOptions) {
  const [appState, setAppState] = useState<AppStateType>(
    AppState.currentState as AppStateType
  );
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      const currentState = nextAppState as AppStateType;

      // Check if app came to foreground
      if (
        (previousState === 'background' || previousState === 'inactive') &&
        nextAppState === 'active'
      ) {
        options?.onForeground?.();
      }

      // Check if app went to background
      if (previousState === 'active' && nextAppState !== 'active') {
        options?.onBackground?.();
      }

      appStateRef.current = nextAppState;
      setAppState(currentState);
      options?.onChange?.(currentState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [options]);

  return {
    appState,
    isActive: appState === 'active',
    isBackground: appState === 'background',
    isInactive: appState === 'inactive',
  };
}

// ============================================================================
// Foreground-only effect hook
// ============================================================================

export function useOnForeground(callback: () => void) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    let previousState = AppState.currentState;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        (previousState === 'background' || previousState === 'inactive') &&
        nextAppState === 'active'
      ) {
        savedCallback.current();
      }
      previousState = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);
}

// ============================================================================
// Background detection hook
// ============================================================================

export function useOnBackground(callback: () => void) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    let previousState = AppState.currentState;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (previousState === 'active' && nextAppState !== 'active') {
        savedCallback.current();
      }
      previousState = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);
}

// ============================================================================
// Session check on foreground (for auth refresh)
// ============================================================================

export function useSessionCheckOnForeground(checkSession: () => Promise<void>) {
  const lastCheckRef = useRef<number>(Date.now());
  const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  useOnForeground(() => {
    const now = Date.now();
    // Only check if more than 5 minutes since last check
    if (now - lastCheckRef.current > CHECK_INTERVAL) {
      lastCheckRef.current = now;
      checkSession();
    }
  });
}

// ============================================================================
// Inactivity timer hook
// ============================================================================

export function useInactivityTimer(
  onInactive: () => void,
  timeoutMs: number = 30 * 60 * 1000 // 30 minutes default
) {
  const timerRef = useRef<TimerId | null>(null);
  const { isActive } = useAppState();

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(onInactive, timeoutMs);
  }, [onInactive, timeoutMs]);

  useEffect(() => {
    if (isActive) {
      resetTimer();
    } else {
      // Clear timer when app goes to background
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isActive, resetTimer]);

  return { resetTimer };
}

export default useAppState;
