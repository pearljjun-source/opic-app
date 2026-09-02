/**
 * @jest-environment jsdom
 *
 * 웹 보안 테스트 (실행 검증 + 구조 가드)
 *
 * jsdom 환경을 쓰는 이유: 검증 대상이 웹 전용 localStorage 세션 정리라,
 * 기본 react-native 환경에는 localStorage가 없다.
 *
 * ⚠️ 이 파일은 원래 두 가지 문제가 있었다.
 *    (1) signOut 테스트가 테스트 안에서 `if (Platform.OS === 'web') { location.href = '/' }`
 *        를 직접 실행하고 그것을 검증했다 — 앱 코드가 전혀 관여하지 않는 항진(tautology).
 *    (2) 나머지는 화면 소스를 readFileSync로 읽어 문자열을 대조했다.
 *
 *    지금은 세션 정리 로직을 lib/auth-session.ts로 꺼내 실제로 호출해 검증한다.
 *
 * 검증 대상:
 * 1. purgeSupabaseAuthTokens — 공용 PC에서 세션 토큰이 남지 않는다 (실행)
 * 2. 라우트 경로 충돌(settings → manage) — 파일시스템 구조라 실행 불가, 구조 가드로 유지
 *
 * 아래는 컴포넌트 테스트 영역이라 여기서 뺐다 (CLAUDE.md "테스트 로드맵" 3단계):
 * - signOut 후 window.location.href로 전체 리로드하는지 (useAuth 마운트 필요)
 * - 미인증 시 웹 리다이렉트 분기 (라우팅 이펙트)
 * - login.tsx가 포커스 시 비밀번호를 비우는지 (useFocusEffect)
 */

import { Platform } from 'react-native';
import * as fs from 'fs';
import * as path from 'path';

import { isSupabaseAuthTokenKey, purgeSupabaseAuthTokens } from '@/lib/auth-session';

const originalOS = Platform.OS;

function mockPlatformOS(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

beforeEach(() => {
  mockPlatformOS('web');
  localStorage.clear();
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true });
  localStorage.clear();
});

// ============================================================================
// 1. 세션 토큰 정리 — 공용 PC 보안
//
//    signOut RPC가 실패해도 localStorage 토큰은 반드시 지워져야 한다.
//    남으면 다음 사람이 같은 브라우저를 열었을 때 그대로 재인증된다.
// ============================================================================

describe('isSupabaseAuthTokenKey', () => {
  it('Supabase 세션 토큰 키를 알아본다', () => {
    expect(isSupabaseAuthTokenKey('sb-nnneyjvcbevwmsvvundr-auth-token')).toBe(true);
  });

  it('접두사만 같은 키는 대상이 아니다', () => {
    expect(isSupabaseAuthTokenKey('sb-something-else')).toBe(false);
  });

  it('접미사만 같은 키는 대상이 아니다', () => {
    expect(isSupabaseAuthTokenKey('other-auth-token')).toBe(false);
  });

  it('앱이 쓰는 다른 키는 대상이 아니다', () => {
    expect(isSupabaseAuthTokenKey('theme')).toBe(false);
    expect(isSupabaseAuthTokenKey('cache:profile')).toBe(false);
  });
});

describe('purgeSupabaseAuthTokens — 웹', () => {
  it('세션 토큰을 지운다', () => {
    localStorage.setItem('sb-abc123-auth-token', '{"access_token":"secret"}');

    const removed = purgeSupabaseAuthTokens();

    expect(removed).toEqual(['sb-abc123-auth-token']);
    expect(localStorage.getItem('sb-abc123-auth-token')).toBeNull();
  });

  it('프로젝트가 여러 개여도 전부 지운다', () => {
    localStorage.setItem('sb-aaa-auth-token', '1');
    localStorage.setItem('sb-bbb-auth-token', '2');

    const removed = purgeSupabaseAuthTokens();

    expect(removed).toHaveLength(2);
    expect(localStorage.getItem('sb-aaa-auth-token')).toBeNull();
    expect(localStorage.getItem('sb-bbb-auth-token')).toBeNull();
  });

  it('Supabase 키가 아닌 것은 건드리지 않는다 — 전체 clear가 아니다', () => {
    localStorage.setItem('sb-abc123-auth-token', 'secret');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('sb-abc123-other', 'keep-me');

    purgeSupabaseAuthTokens();

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('sb-abc123-other')).toBe('keep-me');
  });

  it('토큰이 없으면 아무것도 지우지 않고 빈 배열을 돌려준다', () => {
    localStorage.setItem('theme', 'dark');

    expect(purgeSupabaseAuthTokens()).toEqual([]);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('removeItem이 던져도 나머지 키 삭제를 멈추지 않는다 (사파리 프라이빗 모드)', () => {
    localStorage.setItem('sb-aaa-auth-token', '1');
    localStorage.setItem('sb-bbb-auth-token', '2');

    const realRemove = Storage.prototype.removeItem;
    const spy = jest
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementationOnce(() => { throw new Error('QuotaExceeded'); })
      .mockImplementation(function (this: Storage, k: string) { realRemove.call(this, k); });

    expect(() => purgeSupabaseAuthTokens()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(2); // 첫 키가 실패해도 두 번째를 시도했다

    spy.mockRestore();
  });
});

describe('purgeSupabaseAuthTokens — 네이티브', () => {
  it('웹이 아니면 아무것도 하지 않는다 (세션은 SecureStore에 있다)', () => {
    localStorage.setItem('sb-abc123-auth-token', 'secret');
    mockPlatformOS('ios');

    expect(purgeSupabaseAuthTokens()).toEqual([]);
    expect(localStorage.getItem('sb-abc123-auth-token')).toBe('secret');
  });
});

// ============================================================================
// 2. 라우트 경로 충돌 가드 (구조 검사)
//
//    ⚠️ 이 절은 파일시스템 구조를 본다 — 실행으로는 검증할 수 없다.
//    탭 라우트 `(tabs)/settings`와 폴더 라우트 `(teacher)/settings/`가 웹에서
//    같은 URL로 충돌했던 실제 버그가 있어, 되돌아오지 않도록 남겨 둔다.
// ============================================================================

const APP_ROOT = path.resolve(__dirname, '../..');

describe('라우트 경로 충돌 가드 — settings → manage', () => {
  it('(teacher)/settings 폴더가 되살아나지 않았다', () => {
    expect(fs.existsSync(path.join(APP_ROOT, 'app/(teacher)/settings'))).toBe(false);
  });

  it('manage 폴더에 화면 파일이 모두 있다', () => {
    const manageDir = path.join(APP_ROOT, 'app/(teacher)/manage');
    const files = fs.readdirSync(manageDir);

    expect(files).toEqual(expect.arrayContaining([
      '_layout.tsx',
      'academy-info.tsx',
      'payment-callback.tsx',
      'plan-select.tsx',
      'subscription.tsx',
      'teacher-management.tsx',
    ]));
  });

  it('소스 어디에서도 옛 /(teacher)/settings/ 경로를 참조하지 않는다', () => {
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          if (fs.readFileSync(full, 'utf8').includes('(teacher)/settings/')) {
            offenders.push(path.relative(APP_ROOT, full));
          }
        }
      }
    };

    for (const dir of ['app', 'components', 'hooks', 'lib', 'services']) {
      walk(path.join(APP_ROOT, dir));
    }

    expect(offenders).toEqual([]);
  });
});
