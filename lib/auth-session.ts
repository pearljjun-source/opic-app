import { Platform } from 'react-native';

// ============================================================================
// 웹 세션 정리 유틸
//
// useAuth 안에 인라인으로 두면 훅을 마운트해야만 검증할 수 있어서,
// 공용 PC 보안에 직결되는 이 로직이 테스트 밖에 남는다. 여기로 꺼내 둔다.
// ============================================================================

/** Supabase가 localStorage에 쓰는 세션 토큰 키 패턴 (`sb-<project-ref>-auth-token`) */
const SUPABASE_TOKEN_PREFIX = 'sb-';
const SUPABASE_TOKEN_SUFFIX = '-auth-token';

/** 주어진 키가 Supabase 세션 토큰인지 */
export function isSupabaseAuthTokenKey(key: string): boolean {
  return key.startsWith(SUPABASE_TOKEN_PREFIX) && key.endsWith(SUPABASE_TOKEN_SUFFIX);
}

/**
 * localStorage에 남은 Supabase 세션 토큰을 제거한다.
 *
 * ⚠️ signOut RPC가 실패해도 반드시 호출되어야 한다. 토큰이 남으면 다음 사람이
 *    같은 브라우저를 열었을 때 그대로 재인증된다 (공용 PC).
 *
 * ⚠️ Supabase 키만 지운다. localStorage 전체를 비우면 테마·동의 여부 같은
 *    다른 앱 상태까지 날아간다.
 *
 * @returns 제거한 키 목록
 */
export function purgeSupabaseAuthTokens(): string[] {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return [];

  const removed: string[] = [];
  // 순회 중 삭제하면 인덱스가 밀리므로 목록을 먼저 만든다
  for (const key of Object.keys(localStorage)) {
    if (isSupabaseAuthTokenKey(key)) removed.push(key);
  }

  for (const key of removed) {
    try {
      localStorage.removeItem(key);
    } catch {
      // 사파리 프라이빗 모드 등에서 던질 수 있다 — 나머지 키 삭제를 막지 않는다
    }
  }

  return removed;
}
