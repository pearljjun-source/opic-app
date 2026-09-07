/**
 * Cron 호출 인증 (실행 검증)
 *
 * 이 테스트가 지키려는 회귀는 실제로 프로덕션에 있던 상태다.
 *
 *   const cronSecret = Deno.env.get('CRON_SECRET');
 *   if (cronSecret) { ...검증... }
 *
 * 환경변수를 설정하지 않으면 검증을 통째로 건너뛴다. 이 프로젝트는 CRON_SECRET 을
 * 설정한 적이 없었고, 그래서 배포된 subscription-renew — 결제를 일으키는 함수가 —
 * 누구나 호출할 수 있는 상태로 있었다 (2026-09-08 확인).
 *
 * 그러므로 여기서 가장 중요한 것은 **시크릿이 없을 때 거부하는가** 이다.
 */

import { checkCronAuth } from '../../supabase/functions/_shared/cron-auth';

describe('checkCronAuth — 설정이 없으면 거부한다', () => {
  it('CRON_SECRET 이 없으면 헤더가 뭐든 거부한다', () => {
    for (const provided of [null, undefined, '', 'anything', 'guessed-secret']) {
      const result = checkCronAuth(provided, undefined);
      expect(result.ok).toBe(false);
    }
  });

  it('설정 누락은 401 이 아니라 500 이다', () => {
    // 401 로 답하면 "시크릿이 틀렸나" 로 오해하게 된다. 원인은 설정 안 함이다.
    const result = checkCronAuth('whatever', undefined);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(500);
    expect(result.log).toMatch(/not configured/);
  });

  it('빈 문자열도 설정되지 않은 것으로 본다', () => {
    // 시크릿을 지웠다가 빈 값으로 남겨두는 실수를 통과시키면 안 된다.
    expect(checkCronAuth('', '').ok).toBe(false);
    expect(checkCronAuth('x', '').ok).toBe(false);
  });
});

describe('checkCronAuth — 설정이 있을 때', () => {
  const SECRET = 'zz-test-cron-secret-1234567890';

  it('일치하면 통과한다', () => {
    expect(checkCronAuth(SECRET, SECRET)).toEqual({ ok: true });
  });

  it('불일치는 401 로 거부한다', () => {
    const result = checkCronAuth('wrong', SECRET);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(401);
    // 내부 사정을 흘리지 않는다
    expect(result.error).toBe('Unauthorized');
  });

  it('헤더가 아예 없으면 거부한다', () => {
    expect(checkCronAuth(null, SECRET).ok).toBe(false);
    expect(checkCronAuth(undefined, SECRET).ok).toBe(false);
    expect(checkCronAuth('', SECRET).ok).toBe(false);
  });

  it('앞부분만 맞거나 접두사여도 거부한다', () => {
    expect(checkCronAuth(SECRET.slice(0, -1), SECRET).ok).toBe(false);
    expect(checkCronAuth(SECRET + 'x', SECRET).ok).toBe(false);
  });

  it('대소문자와 공백을 구분한다', () => {
    expect(checkCronAuth(SECRET.toUpperCase(), SECRET).ok).toBe(false);
    expect(checkCronAuth(' ' + SECRET, SECRET).ok).toBe(false);
  });

  it('멀티바이트 시크릿도 정확히 비교한다', () => {
    // TextEncoder 로 바이트 비교하므로 한글도 안전해야 한다
    expect(checkCronAuth('비밀-키', '비밀-키')).toEqual({ ok: true });
    expect(checkCronAuth('비밀-키', '비밀-값').ok).toBe(false);
  });
});
