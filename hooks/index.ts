// Hooks barrel export
export {
  AuthProvider,
  useAuth,
  useUser,
  useSession,
  useIsAuthenticated,
  useRole,
} from './useAuth';
export {
  useNetworkStatus,
  useIsOnline,
  useOfflineAwareFetch,
  type NetworkStatus,
} from './useNetworkStatus';
export {
  useAppState,
  useOnForeground,
  useOnBackground,
  useSessionCheckOnForeground,
  useInactivityTimer,
  type AppStateType,
  type UseAppStateOptions,
} from './useAppState';
export { usePushNotifications } from './usePushNotifications';
