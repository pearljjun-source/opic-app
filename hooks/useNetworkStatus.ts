import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';

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
// Hook
// ============================================================================

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: null,
    isWifi: false,
    isCellular: false,
  });

  const updateNetworkStatus = useCallback((state: NetInfoState) => {
    setNetworkStatus({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isWifi: state.type === 'wifi',
      isCellular: state.type === 'cellular',
    });
  }, []);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then(updateNetworkStatus);

    // Subscribe to network status changes
    const unsubscribe = NetInfo.addEventListener(updateNetworkStatus);

    return () => {
      unsubscribe();
    };
  }, [updateNetworkStatus]);

  // Manual refresh
  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    updateNetworkStatus(state);
    return state.isConnected ?? false;
  }, [updateNetworkStatus]);

  return {
    ...networkStatus,
    refresh,
  };
}

// ============================================================================
// Simple connectivity hook
// ============================================================================

export function useIsOnline() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  // Consider online if connected and (internet reachable or unknown)
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
