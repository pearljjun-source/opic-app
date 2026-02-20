import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { User, UserRole, OrgRole, PlatformRole, MyOrganization } from '@/lib/types';
import { canTeach } from '@/lib/permissions';

// ============================================================================
// SSR-safe cache helpers
// ============================================================================

const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

const safeGetItem = (key: string): Promise<string | null> =>
  isSSR ? Promise.resolve(null) : AsyncStorage.getItem(key);

const safeSetItem = (key: string, value: string): void => {
  if (!isSSR) AsyncStorage.setItem(key, value);
};

const safeMultiRemove = (keys: string[]): void => {
  if (!isSSR) AsyncStorage.multiRemove(keys);
};

// ============================================================================
// Cache keys
// ============================================================================

const CACHE_KEY_ROLE = 'auth_cached_role';
const CACHE_KEY_PROFILE = 'auth_cached_profile';
const CACHE_KEY_ORG = 'auth_cached_org';
const CACHE_KEY_ORGS = 'auth_cached_orgs';

// ============================================================================
// Types
// ============================================================================

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Legacy role from users.role (점진적 폐기) */
  role: UserRole | null;
  /** 플랫폼 역할 (super_admin) */
  platformRole: PlatformRole | null;
  /** 현재 선택된 조직 */
  currentOrg: MyOrganization | null;
  /** 현재 조직에서의 역할 */
  orgRole: OrgRole | null;
  /** 소속 조직 목록 */
  organizations: MyOrganization[];
  /** @internal 프로필이 DB에서 검증되었는지 (캐시 불일치 방지) */
  _profileVerified: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null; autoLoggedIn: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshUser: () => Promise<void>;
  switchOrganization: (orgId: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    role: null,
    platformRole: null,
    currentOrg: null,
    orgRole: null,
    organizations: [],
    _profileVerified: false,
  });

  const router = useRouter();
  const segments = useSegments();

  // Fetch organizations from get_my_organizations RPC
  const fetchOrganizations = useCallback(async (): Promise<MyOrganization[]> => {
    const { data, error } = await (supabase.rpc as CallableFunction)('get_my_organizations');
    if (error || !data) {
      if (__DEV__) console.warn('[Auth] Error fetching organizations:', error);
      return [];
    }
    return data as MyOrganization[];
  }, []);

  // Fetch user profile from public.users table + organizations + cache
  const fetchUserProfile = useCallback(async (userId: string): Promise<{
    profile: User | null;
    orgs: MyOrganization[];
  }> => {
    const [profileResult, orgs] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      fetchOrganizations(),
    ]);

    if (profileResult.error) {
      if (__DEV__) console.warn('[Auth] Error fetching profile:', profileResult.error);
      return { profile: null, orgs: [] };
    }

    const profile = profileResult.data;

    // Cache for instant next startup
    if (profile) {
      safeSetItem(CACHE_KEY_ROLE, profile.role);
      safeSetItem(CACHE_KEY_PROFILE, JSON.stringify(profile));
      safeSetItem(CACHE_KEY_ORGS, JSON.stringify(orgs));
    }

    return { profile, orgs };
  }, [fetchOrganizations]);

  // Determine current org: from cache or auto-select
  const resolveCurrentOrg = useCallback(async (orgs: MyOrganization[]): Promise<MyOrganization | null> => {
    if (orgs.length === 0) return null;
    if (orgs.length === 1) {
      safeSetItem(CACHE_KEY_ORG, JSON.stringify(orgs[0]));
      return orgs[0];
    }

    // Multi-org: try cached selection
    const cachedOrgStr = await safeGetItem(CACHE_KEY_ORG);
    if (cachedOrgStr) {
      try {
        const cached = JSON.parse(cachedOrgStr) as MyOrganization;
        const found = orgs.find(o => o.id === cached.id);
        if (found) return found;
      } catch {
        // 캐시 손상 → 무시하고 첫 번째 org 사용
      }
    }

    // Default to first org
    safeSetItem(CACHE_KEY_ORG, JSON.stringify(orgs[0]));
    return orgs[0];
  }, []);

  // Build full state from profile + orgs
  const buildAuthState = useCallback(async (
    session: Session,
    profile: User | null,
    orgs: MyOrganization[],
  ): Promise<Partial<AuthState>> => {
    const currentOrg = await resolveCurrentOrg(orgs);
    const platformRole = (profile as Record<string, unknown>)?.platform_role as PlatformRole | null ?? null;

    return {
      user: profile,
      session,
      isLoading: false,
      isAuthenticated: true,
      role: profile?.role || null,
      platformRole,
      currentOrg,
      orgRole: currentOrg?.role || null,
      organizations: orgs,
    };
  }, [resolveCurrentOrg]);

  // ============================================================================
  // Auth init timeout — 어떤 이유든 10초 안에 초기화 안 되면 로그인 화면으로
  // ============================================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setState(prev => {
        // 이미 정상 완료된 경우 무시
        if (!prev.isLoading && prev._profileVerified) return prev;
        // 초기화 또는 프로필 검증 미완료 → 강제 로그아웃
        if (__DEV__) console.warn('[Auth] Init timeout — forcing logged out state');
        safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
        return {
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
          role: null,
          platformRole: null,
          currentOrg: null,
          orgRole: null,
          organizations: [],
          _profileVerified: true,
        };
      });
    }, 5_000);
    return () => clearTimeout(timer);
  }, []);

  // ============================================================================
  // Auth state listener — single source of truth
  //
  // CRITICAL: onAuthStateChange 콜백은 Supabase 내부 lock 안에서 실행됨.
  // 콜백 안에서 supabase.auth.getUser(), signOut() 등 auth API를 호출하면
  // pendingInLock 큐의 순환 대기로 promise-level 데드락 발생.
  // → 모든 auth API 호출은 setTimeout(fn, 0)으로 콜백 밖에서 실행해야 함.
  // 참고: GoTrueClient.ts _acquireLock() re-entrant path
  // ============================================================================
  // ============================================================================
  // Profile loading — lock 밖에서 실행 (네트워크 호출)
  //
  // CRITICAL: 이 함수들은 onAuthStateChange 콜백 밖에서만 호출해야 함.
  // 콜백 안에서 네트워크 호출 → navigator.locks 점유 → 다른 auth 작업 차단
  // ============================================================================

  // 세션 토큰 검증 + 프로필 로드 (앱 시작 시)
  const validateAndLoadProfile = useCallback(async (session: Session) => {
    try {
      const { error: tokenError } = await supabase.auth.getUser();
      if (tokenError) {
        if (__DEV__) console.warn('[Auth] Token invalid:', tokenError.message);
        safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
        setState({
          user: null, session: null, isLoading: false, isAuthenticated: false,
          role: null, platformRole: null, currentOrg: null, orgRole: null,
          organizations: [], _profileVerified: true,
        });
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        return;
      }

      const { profile, orgs } = await fetchUserProfile(session.user.id);
      if (profile) {
        const freshState = await buildAuthState(session, profile, orgs);
        setState(prev => {
          // signOut이 이미 실행되었으면 프로필 로드 결과 무시 (경쟁 조건 방지)
          if (!prev.isAuthenticated) return prev;
          return { ...prev, ...freshState, _profileVerified: true };
        });
      } else {
        setState(prev => {
          if (!prev.isAuthenticated) return prev;
          return { ...prev, isLoading: false, _profileVerified: true };
        });
      }
    } catch (err) {
      if (__DEV__) console.warn('[Auth] Session validation error:', err);
      setState(prev => {
        if (!prev.isAuthenticated) return prev;
        return { ...prev, isLoading: false, _profileVerified: true };
      });
    }
  }, [fetchUserProfile, buildAuthState]);

  // 프로필만 로드 (이미 인증된 상태 — 로그인/토큰 갱신 후)
  const loadProfile = useCallback(async (session: Session) => {
    try {
      const { profile, orgs } = await fetchUserProfile(session.user.id);
      if (profile) {
        const freshState = await buildAuthState(session, profile, orgs);
        setState(prev => {
          if (!prev.isAuthenticated) return prev;
          return { ...prev, ...freshState, _profileVerified: true };
        });
      } else {
        setState(prev => {
          if (!prev.isAuthenticated) return prev;
          return { ...prev, isLoading: false, _profileVerified: true };
        });
      }
    } catch (err) {
      if (__DEV__) console.warn('[Auth] Profile load error:', err);
      setState(prev => {
        if (!prev.isAuthenticated) return prev;
        return { ...prev, isLoading: false, _profileVerified: true };
      });
    }
  }, [fetchUserProfile, buildAuthState]);

  // ============================================================================
  // Auth state listener
  //
  // CRITICAL: onAuthStateChange 콜백은 Supabase 내부 lock 안에서 실행됨.
  // 웹: navigator.locks — lock 점유 중 다른 auth 작업 (getUser, signOut) 차단
  // RN: 내부 pendingInLock 큐 — 순환 대기 시 promise-level 데드락
  //
  // 원칙: 콜백은 로컬 캐시 읽기 + 즉각 상태 설정만 수행.
  //       모든 네트워크 호출은 setTimeout으로 lock 밖에서 실행.
  // ============================================================================
  useEffect(() => {
    const loggedOutState: AuthState = {
      user: null, session: null, isLoading: false, isAuthenticated: false,
      role: null, platformRole: null, currentOrg: null, orgRole: null,
      organizations: [], _profileVerified: true,
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
        // ----------------------------------------------------------------
        // INITIAL_SESSION: 앱 시작 시 로컬 세션으로 즉시 UI 표시
        // ----------------------------------------------------------------
        if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            // 캐시에서 role + profile + orgs 읽기 (로컬, ~10ms — lock 안전)
            const [cachedRole, cachedProfileStr, cachedOrgsStr] = await Promise.all([
              safeGetItem(CACHE_KEY_ROLE),
              safeGetItem(CACHE_KEY_PROFILE),
              safeGetItem(CACHE_KEY_ORGS),
            ]);

            let cachedProfile: User | null = null;
            let cachedOrgs: MyOrganization[] = [];
            try {
              if (cachedProfileStr) cachedProfile = JSON.parse(cachedProfileStr) as User;
              if (cachedOrgsStr) cachedOrgs = JSON.parse(cachedOrgsStr) as MyOrganization[];
            } catch {
              safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
            }

            if (cachedRole && cachedProfile) {
              // Fast path: 캐시 있음 → 즉시 UI 표시 (검증은 백그라운드)
              const cachedState = await buildAuthState(session, cachedProfile, cachedOrgs);
              setState(prev => ({ ...prev, ...cachedState, _profileVerified: false }));
            } else {
              // 캐시 없음 → isLoading 즉시 해제 (검증 대기 표시는 _profileVerified로)
              setState(prev => ({
                ...prev,
                session,
                isLoading: false,
                isAuthenticated: true,
                _profileVerified: false,
              }));
            }

            // 토큰 검증 + 프로필 갱신 — lock 밖에서 실행 (데드락 방지)
            setTimeout(() => { validateAndLoadProfile(session).catch(() => {}); }, 0);

          } else {
            // 세션 없음 → 로그인 화면으로
            setState(loggedOutState);
          }

        // ----------------------------------------------------------------
        // SIGNED_IN: 로그인 성공 — 즉시 인증 상태로, 프로필은 lock 밖에서
        // ----------------------------------------------------------------
        } else if (event === 'SIGNED_IN' && session?.user) {
          setState(prev => ({
            ...prev,
            session,
            isLoading: false,
            isAuthenticated: true,
            _profileVerified: false,
          }));
          // 프로필 로드 — lock 밖에서 실행
          setTimeout(() => { loadProfile(session).catch(() => {}); }, 0);

        // ----------------------------------------------------------------
        // SIGNED_OUT: 로그아웃
        // ----------------------------------------------------------------
        } else if (event === 'SIGNED_OUT') {
          safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
          setState(loggedOutState);

        // ----------------------------------------------------------------
        // TOKEN_REFRESHED: 토큰 갱신 — 프로필 lock 밖에서 갱신
        // ----------------------------------------------------------------
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setTimeout(() => { loadProfile(session).catch(() => {}); }, 0);
        }

        } catch (err) {
          if (__DEV__) console.warn('[Auth] onAuthStateChange error:', err);
          safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
          setState(loggedOutState);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [validateAndLoadProfile, loadProfile, buildAuthState]);

  // ============================================================================
  // Routing based on auth state
  // ============================================================================
  useEffect(() => {
    if (state.isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTeacherGroup = segments[0] === '(teacher)';
    const inStudentGroup = segments[0] === '(student)';
    const inAdminGroup = segments[0] === '(admin)';
    const inProtectedGroup = inTeacherGroup || inStudentGroup || inAdminGroup;
    const isRootRoute = !segments[0] || (segments[0] as string) === 'index';

    // ① 미인증 → 웹은 랜딩 페이지, 네이티브는 로그인 페이지로
    if (!state.isAuthenticated) {
      if (inAuthGroup) return; // 이미 로그인/회원가입 화면
      if (Platform.OS === 'web') {
        if (isRootRoute) return; // 이미 랜딩 페이지
        // 전체 페이지 리로드: SPA router.replace('/')는 group index와 URL 충돌 가능.
        // 전체 리로드로 네비게이션 상태 + 컴포넌트 메모리(비밀번호 등) 완전 제거.
        window.location.href = '/';
        return;
      } else {
        router.replace('/(auth)/login');
      }
      return;
    }

    // ② 인증됨 but 프로필 미검증 → 라우팅 보류
    // 로그인 직후 또는 INITIAL_SESSION 검증 중 — role이 확정되기 전 이동하면
    // 잘못된 그룹으로 이동 후 깜빡임/리다이렉트 반복 발생
    if (!state._profileVerified) return;

    // ③ 인증 + 프로필 검증 완료 → 올바른 화면으로
    const homeForUser = () => {
      if (state.platformRole === 'super_admin') return '/(admin)' as const;
      if (!state.currentOrg) return '/(student)' as const;
      if (canTeach(state.orgRole)) return '/(teacher)' as const;
      return '/(student)' as const;
    };

    const correctHome = homeForUser();

    if (inAuthGroup) {
      // 인증 완료 → auth 그룹(로그인/회원가입)에서 나감
      router.replace(correctHome as any);
    } else if (!inProtectedGroup) {
      // 인증된 사용자는 웹 루트(랜딩)를 포함한 모든 비보호 경로에서 홈으로 이동
      router.replace(correctHome as any);
    } else {
      // protected 그룹에 있지만 잘못된 그룹이면 수정
      const inCorrectGroup =
        (correctHome === '/(admin)' && inAdminGroup) ||
        (correctHome === '/(teacher)' && inTeacherGroup) ||
        (correctHome === '/(student)' && inStudentGroup);
      if (!inCorrectGroup) {
        router.replace(correctHome as any);
      }
    }
  }, [state.isAuthenticated, state.isLoading, state._profileVerified, state.role, state.platformRole, state.orgRole, state.currentOrg, segments, router]);

  // ============================================================================
  // Sign in
  // ============================================================================
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // ============================================================================
  // Sign up
  // ============================================================================

  // public.users 행 생성 대기 (handle_new_user 트리거 완료 확인)
  const waitForUserRow = async (userId: string) => {
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();
      if (data) return;
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const signUp = useCallback(async (
    email: string,
    password: string,
    name: string,
  ): Promise<{ error: Error | null; autoLoggedIn: boolean }> => {
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (signUpError) {
        return { error: new Error(signUpError.message), autoLoggedIn: false };
      }

      const autoLoggedIn = !!data.session;

      if (autoLoggedIn && data.user) {
        await waitForUserRow(data.user.id);
      }

      return { error: null, autoLoggedIn };
    } catch (error) {
      return { error: error as Error, autoLoggedIn: false };
    }
  }, []);

  // ============================================================================
  // Sign out
  // ============================================================================
  const signOut = useCallback(async () => {
    // 먼저 로컬 상태 즉시 초기화 (UI 즉시 반영)
    safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
    setState({
      user: null, session: null, isLoading: false, isAuthenticated: false,
      role: null, platformRole: null, currentOrg: null, orgRole: null,
      organizations: [], _profileVerified: true,
    });
    // Supabase 세션 정리 (실패해도 위에서 이미 로그아웃 상태)
    try {
      await supabase.auth.signOut();
    } catch (err) {
      if (__DEV__) console.warn('[Auth] signOut error:', err);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (_) {}
    }
    // 웹: 전체 페이지 리로드로 네비게이션 상태 + 컴포넌트 메모리 완전 제거
    // SPA router.replace('/')는 group index URL 충돌 + 비밀번호 등 폼 상태 잔존 위험
    if (Platform.OS === 'web') {
      window.location.href = '/';
    }
  }, []);

  // ============================================================================
  // Reset password
  // ============================================================================
  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // ============================================================================
  // Refresh user profile + organizations
  // ============================================================================
  const refreshUser = useCallback(async () => {
    if (state.session?.user) {
      const { profile, orgs } = await fetchUserProfile(state.session.user.id);
      if (profile) {
        const newState = await buildAuthState(state.session, profile, orgs);
        setState(prev => ({ ...prev, ...newState }));
      }
    }
  }, [state.session, fetchUserProfile, buildAuthState]);

  // ============================================================================
  // Switch organization (multi-org)
  // ============================================================================
  const switchOrganization = useCallback((orgId: string) => {
    const org = state.organizations.find(o => o.id === orgId);
    if (!org) return;

    safeSetItem(CACHE_KEY_ORG, JSON.stringify(org));
    setState(prev => ({
      ...prev,
      currentOrg: org,
      orgRole: org.role,
    }));
  }, [state.organizations]);

  const value: AuthContextType = {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshUser,
    switchOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// Utility hooks
// ============================================================================

export function useUser() {
  const { user } = useAuth();
  return user;
}

export function useSession() {
  const { session } = useAuth();
  return session;
}

export function useIsAuthenticated() {
  const { isAuthenticated, isLoading } = useAuth();
  return { isAuthenticated, isLoading };
}

export function useRole() {
  const { role } = useAuth();
  return role;
}

export function useOrgRole() {
  const { orgRole } = useAuth();
  return orgRole;
}

export function useCurrentOrg() {
  const { currentOrg } = useAuth();
  return currentOrg;
}

export default useAuth;
