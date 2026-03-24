import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// ============================================================================
// Types
// ============================================================================

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
  isWifi: boolean;
  isCellular: boolean;
}

// ============================================================================
// Singleton store — 단일 NetInfo 구독을 모든 훅에서 공유
// ============================================================================

const DEFAULT_STATUS: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  type: null,
  isWifi: false,
  isCellular: false,
};

let currentStatus: NetworkStatus = DEFAULT_STATUS;
let listeners = new Set<() => void>();
let subscribed = false;

function notifyListeners() {
  listeners.forEach((l) => l());
}

function updateFromNetInfo(state: NetInfoState) {
  const next: NetworkStatus = {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
    isWifi: state.type === 'wifi',
    isCellular: state.type === 'cellular',
  };

  // 변경이 없으면 리렌더링 방지
  if (
    next.isConnected === currentStatus.isConnected &&
    next.isInternetReachable === currentStatus.isInternetReachable &&
    next.type === currentStatus.type
  ) {
    return;
  }

  currentStatus = next;
  notifyListeners();
}

function ensureSubscription() {
  if (subscribed) return;
  subscribed = true;
  NetInfo.fetch().then(updateFromNetInfo);
  NetInfo.addEventListener(updateFromNetInfo);
}

function subscribe(listener: () => void) {
  ensureSubscription();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): NetworkStatus {
  return currentStatus;
}

// ============================================================================
// Hook — useSyncExternalStore로 단일 구독 공유
// ============================================================================

export function useNetworkStatus() {
  const status = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_STATUS);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    updateFromNetInfo(state);
    return state.isConnected ?? false;
  }, []);

  return { ...status, refresh };
}

// ============================================================================
// Simple connectivity hook
// ============================================================================

export function useIsOnline() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  return isConnected && (isInternetReachable === true || isInternetReachable === null);
}

// ============================================================================
// Offline-aware fetch wrapper
// ============================================================================

export function useOfflineAwareFetch() {
  const isOnline = useIsOnline();

  const fetchWithOfflineCheck = useCallback(
    async <T>(
      fetchFn: () => Promise<T>,
      options?: {
        offlineMessage?: string;
        onOffline?: () => void;
      }
    ): Promise<{ data: T | null; error: Error | null; isOffline: boolean }> => {
      if (!isOnline) {
        options?.onOffline?.();
        return {
          data: null,
          error: new Error(options?.offlineMessage || '오프라인 상태입니다'),
          isOffline: true,
        };
      }

      try {
        const data = await fetchFn();
        return { data, error: null, isOffline: false };
      } catch (error) {
        return { data: null, error: error as Error, isOffline: false };
      }
    },
    [isOnline]
  );

  return { fetchWithOfflineCheck, isOnline };
}

export default useNetworkStatus;
