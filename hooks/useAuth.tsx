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
        if (!prev.isLoading) return prev;
        // 초기화 실패 → 캐시 삭제 후 로그인 화면으로
        if (__DEV__) console.warn('[Auth] Init timeout — forcing isLoading: false');
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
    }, 10_000);
    return () => clearTimeout(timer);
  }, []);

  // ============================================================================
  // Auth state listener — single source of truth
  // ============================================================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
        // ----------------------------------------------------------------
        // INITIAL_SESSION: 앱 시작 시 로컬 세션으로 즉시 UI 표시
        // ----------------------------------------------------------------
        if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            // 1) 캐시에서 role + profile + orgs 읽기 (로컬, ~10ms)
            const [cachedRole, cachedProfileStr, cachedOrgsStr] = await Promise.all([
              safeGetItem(CACHE_KEY_ROLE),
              safeGetItem(CACHE_KEY_PROFILE),
              safeGetItem(CACHE_KEY_ORGS),
            ]);

            // 안전한 JSON 파싱 (캐시 손상 방어)
            let cachedProfile: User | null = null;
            let cachedOrgs: MyOrganization[] = [];
            try {
              if (cachedProfileStr) cachedProfile = JSON.parse(cachedProfileStr) as User;
              if (cachedOrgsStr) cachedOrgs = JSON.parse(cachedOrgsStr) as MyOrganization[];
            } catch {
              // 캐시 손상 → 무시하고 DB에서 다시 조회
              safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
            }

            // 토큰 유효성 먼저 검증 (캐시 유무와 무관하게)
            const { error: tokenError } = await supabase.auth.getUser();
            if (tokenError) {
              // 토큰 무효 → 캐시 삭제 + 로컬 로그아웃 (서버 호출 불필요)
              if (__DEV__) console.warn('[Auth] Token invalid, signing out:', tokenError.message);
              safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
              await supabase.auth.signOut({ scope: 'local' });
              return; // SIGNED_OUT 이벤트가 state 초기화 처리
            }

            if (cachedRole && cachedProfile) {
              // Fast path: 토큰 유효 + 캐시 있음 → 즉시 UI 표시
              const cachedState = await buildAuthState(session, cachedProfile, cachedOrgs);
              setState(prev => ({ ...prev, ...cachedState, _profileVerified: false }));

              // Background: DB에서 최신 profile + orgs 갱신
              fetchUserProfile(session.user.id).then(async ({ profile: fresh, orgs: freshOrgs }) => {
                if (fresh) {
                  const freshState = await buildAuthState(session, fresh, freshOrgs);
                  setState(prev => ({ ...prev, ...freshState, _profileVerified: true }));
                } else {
                  // DB fetch 실패해도 검증 완료로 표시 (토큰은 이미 검증됨)
                  setState(prev => ({ ...prev, _profileVerified: true }));
                }
              }).catch(() => {});
            } else {
              // Slow path: 토큰 유효 + 캐시 없음 → DB에서 조회
              const { profile, orgs } = await fetchUserProfile(session.user.id);
              const newState = await buildAuthState(session, profile, orgs);
              setState(prev => ({ ...prev, ...newState, _profileVerified: true }));
            }
          } else {
            // 세션 없음 → 로그인 화면으로
            setState({
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
            });
          }

        // ----------------------------------------------------------------
        // SIGNED_IN: 로그인 성공
        // ----------------------------------------------------------------
        } else if (event === 'SIGNED_IN' && session?.user) {
          const { profile, orgs } = await fetchUserProfile(session.user.id);
          const newState = await buildAuthState(session, profile, orgs);
          setState(prev => ({ ...prev, ...newState, _profileVerified: true }));

        // ----------------------------------------------------------------
        // SIGNED_OUT: 로그아웃
        // ----------------------------------------------------------------
        } else if (event === 'SIGNED_OUT') {
          safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
          setState({
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
          });

        // ----------------------------------------------------------------
        // TOKEN_REFRESHED: 토큰 갱신 시 최신 profile 반영
        // ----------------------------------------------------------------
        } else if (event === 'TOKEN_REFRESHED' && session) {
          const { profile, orgs } = await fetchUserProfile(session.user.id);
          if (profile) {
            const newState = await buildAuthState(session, profile, orgs);
            setState(prev => ({ ...prev, ...newState, _profileVerified: true }));
          }
        }

        } catch (err) {
          // 어떤 에러든 isLoading을 false로 → 앱이 멈추지 않음
          if (__DEV__) console.warn('[Auth] onAuthStateChange error:', err);
          safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE, CACHE_KEY_ORG, CACHE_KEY_ORGS]);
          setState({
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
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, buildAuthState]);

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

    // 역할별 홈 경로 (org 기반)
    const homeForUser = () => {
      // super_admin → admin
      if (state.platformRole === 'super_admin') return '/(admin)' as const;
      // Legacy admin 호환
      if (state.role === 'admin') return '/(admin)' as const;

      // org 없으면 → 학생 초대 코드 화면
      if (!state.currentOrg) return '/(student)' as const;

      // org 역할 기반
      if (canTeach(state.orgRole)) return '/(teacher)' as const;
      return '/(student)' as const;
    };

    // 웹 루트(/): 랜딩 페이지는 인증 여부와 무관하게 항상 접근 가능
    const isRootRoute = !segments[0] || (segments[0] as string) === 'index';
    if (!state.isAuthenticated && !inAuthGroup) {
      if (Platform.OS === 'web' && isRootRoute) return;
      router.replace('/(auth)/login');
    } else if (state.isAuthenticated && inAuthGroup) {
      router.replace(homeForUser() as any);
    } else if (state.isAuthenticated && !inProtectedGroup) {
      if (Platform.OS === 'web' && isRootRoute) return; // 랜딩 페이지에서 자동 리다이렉트 차단
      router.replace(homeForUser() as any);
    } else if (state.isAuthenticated && state._profileVerified) {
      // 잘못된 그룹에 있는 경우 올바른 그룹으로 리다이렉트
      // _profileVerified: DB 검증 후에만 실행 (캐시 불일치로 인한 리다이렉트 반복 방지)
      const correctHome = homeForUser();
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
    await supabase.auth.signOut();
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
