import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').replace(/\s/g, '');

// SSR-safe storage: 정적 렌더링(Node.js)에서 window.localStorage 접근 방지
const noopStorage = {
  getItem: (_key: string) => Promise.resolve(null),
  setItem: (_key: string, _value: string) => Promise.resolve(),
  removeItem: (_key: string) => Promise.resolve(),
};

function getAuthStorage() {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.localStorage : noopStorage;
  }
  return AsyncStorage;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/**
 * Edge Function 호출 wrapper
 * supabase-js v2.94+에서 FunctionsHttpError.context가 Response 객체로 변경됨.
 * 이 wrapper가 Response body를 파싱하여 에러 메시지를 제대로 추출한다.
 */
export async function invokeFunction<T = Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
  // FunctionsClient는 customFetch로 fetchWithAuth를 받으며,
  // fetchWithAuth가 매 요청마다 _getAccessToken() → getSession()으로
  // fresh 토큰을 자동 주입함. 명시적 Authorization 헤더 불필요.
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    // FunctionsHttpError: context는 Response 객체 → body를 파싱해서 에러 추출
    if (error.context && typeof error.context.json === 'function') {
      try {
        const errorBody = await error.context.json();
        if (__DEV__) console.warn(`[EdgeFn] ${name} error:`, error.context.status, errorBody);
        // 에러 본문을 error 객체에 첨부 (classifyFunctionsError에서 사용)
        (error as any)._parsedBody = errorBody;
      } catch {
        if (__DEV__) console.warn(`[EdgeFn] ${name} error: could not parse response body`);
      }
    }
    return { data: null, error };
  }

  return { data: data as T, error: null };
}

// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

// Helper to get current session
export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};
