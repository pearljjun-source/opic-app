import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { User, UserRole } from '@/lib/types';

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

// ============================================================================
// Types
// ============================================================================

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: UserRole | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null; autoLoggedIn: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshUser: () => Promise<void>;
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
  });

  const router = useRouter();
  const segments = useSegments();

  // Fetch user profile from public.users table + cache
  const fetchUserProfile = useCallback(async (userId: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (__DEV__) console.warn('[Auth] Error fetching profile:', error);
      return null;
    }

    // Cache for instant next startup
    if (data) {
      safeSetItem(CACHE_KEY_ROLE, data.role);
      safeSetItem(CACHE_KEY_PROFILE, JSON.stringify(data));
    }

    return data;
  }, []);

  // ============================================================================
  // Auth state listener — single source of truth
  // ============================================================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // ----------------------------------------------------------------
        // INITIAL_SESSION: 앱 시작 시 로컬 세션으로 즉시 UI 표시
        // ----------------------------------------------------------------
        if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            // 1) 캐시에서 role + profile 읽기 (로컬, ~10ms)
            const [cachedRole, cachedProfileStr] = await Promise.all([
              safeGetItem(CACHE_KEY_ROLE),
              safeGetItem(CACHE_KEY_PROFILE),
            ]);
            const cachedProfile = cachedProfileStr
              ? (JSON.parse(cachedProfileStr) as User)
              : null;

            if (cachedRole) {
              // Fast path: 캐시 있음 → 즉시 UI 표시
              setState({
                user: cachedProfile,
                session,
                isLoading: false,
                isAuthenticated: true,
                role: cachedRole as UserRole,
              });

              // Background: DB에서 최신 profile 갱신
              fetchUserProfile(session.user.id).then(fresh => {
                if (fresh) {
                  setState(prev => ({ ...prev, user: fresh, role: fresh.role }));
                }
              });
            } else {
              // Slow path: 캐시 없음 (최초 또는 캐시 삭제) → DB에서 조회
              const profile = await fetchUserProfile(session.user.id);
              setState({
                user: profile,
                session,
                isLoading: false,
                isAuthenticated: true,
                role: profile?.role || null,
              });
            }

            // Background: 서버에서 토큰 유효성 검증
            // 토큰이 서버에서 취소된 경우 → 강제 로그아웃
            supabase.auth.getUser().then(({ error }) => {
              if (error) {
                if (__DEV__) console.warn('[Auth] Token invalid, signing out');
                supabase.auth.signOut();
              }
            });
          } else {
            // 세션 없음 → 로그인 화면으로
            setState({
              user: null,
              session: null,
              isLoading: false,
              isAuthenticated: false,
              role: null,
            });
          }

        // ----------------------------------------------------------------
        // SIGNED_IN: 로그인 성공
        // ----------------------------------------------------------------
        } else if (event === 'SIGNED_IN' && session?.user) {
          const userProfile = await fetchUserProfile(session.user.id);
          setState({
            user: userProfile,
            session,
            isLoading: false,
            isAuthenticated: true,
            role: userProfile?.role || null,
          });

        // ----------------------------------------------------------------
        // SIGNED_OUT: 로그아웃
        // ----------------------------------------------------------------
        } else if (event === 'SIGNED_OUT') {
          safeMultiRemove([CACHE_KEY_ROLE, CACHE_KEY_PROFILE]);
          setState({
            user: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
            role: null,
          });

        // ----------------------------------------------------------------
        // TOKEN_REFRESHED: 토큰 갱신 시 최신 profile 반영
        // ----------------------------------------------------------------
        } else if (event === 'TOKEN_REFRESHED' && session) {
          const userProfile = await fetchUserProfile(session.user.id);
          setState(prev => ({
            ...prev,
            session,
            user: userProfile || prev.user,
            role: userProfile?.role || prev.role,
          }));
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  // ============================================================================
  // Routing based on auth state
  // ============================================================================
  useEffect(() => {
    if (state.isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTeacherGroup = segments[0] === '(teacher)';
    const inStudentGroup = segments[0] === '(student)';
    const inProtectedGroup = inTeacherGroup || inStudentGroup;

    // 웹 랜딩 페이지: 미인증 사용자가 루트(/)에서 로그인 화면으로 리다이렉트되지 않도록 허용
    const isRootRoute = !segments[0] || segments[0] === 'index';
    if (!state.isAuthenticated && !inAuthGroup) {
      if (Platform.OS === 'web' && isRootRoute) return;
      router.replace('/(auth)/login');
    } else if (state.isAuthenticated && inAuthGroup) {
      if (state.role === 'teacher') {
        router.replace('/(teacher)');
      } else if (state.role === 'student') {
        router.replace('/(student)');
      }
    } else if (state.isAuthenticated && !inProtectedGroup) {
      if (state.role === 'teacher') {
        router.replace('/(teacher)');
      } else if (state.role === 'student') {
        router.replace('/(student)');
      }
    } else if (state.isAuthenticated) {
      if (state.role === 'teacher' && inStudentGroup) {
        router.replace('/(teacher)');
      } else if (state.role === 'student' && inTeacherGroup) {
        router.replace('/(student)');
      }
    }
  }, [state.isAuthenticated, state.isLoading, state.role, segments, router]);

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
  // 최대 3초 (300ms × 10회) 폴링 후 포기 (포기해도 이후 자연스럽게 해소됨)
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

  // role은 서버(handle_new_user 트리거)에서 무조건 'student'로 설정
  // 강사 승격은 admin이 promote_to_teacher RPC로만 가능
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

      // 레이스 컨디션 방지: public.users 행이 생성될 때까지 대기
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
  // Refresh user profile
  // ============================================================================
  const refreshUser = useCallback(async () => {
    if (state.session?.user) {
      const userProfile = await fetchUserProfile(state.session.user.id);
      if (userProfile) {
        setState(prev => ({
          ...prev,
          user: userProfile,
          role: userProfile.role,
        }));
      }
    }
  }, [state.session, fetchUserProfile]);

  const value: AuthContextType = {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshUser,
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

export default useAuth;
