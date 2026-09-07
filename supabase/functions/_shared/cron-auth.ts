/**
 * Cron 호출 인증.
 *
 * ⚠️ **시크릿이 설정되어 있지 않으면 거부한다(fail-closed).**
 *
 * 원래는 각 함수가 이렇게 썼다.
 *
 *   const cronSecret = Deno.env.get('CRON_SECRET');
 *   if (cronSecret) { ...검증... }
 *
 * 환경변수가 없으면 검증 블록을 통째로 건너뛴다. 즉 **시크릿을 설정하지 않은
 * 상태에서는 누구나 함수를 호출할 수 있었다.** 이 프로젝트가 실제로 그 상태였고,
 * 배포된 subscription-renew 가 그렇게 공개되어 있었다 (2026-09-08 확인).
 *
 * 이 함수들은 결제를 일으키거나 파일을 지운다. "설정을 깜빡했다" 가 "인증이
 * 사라진다" 로 이어지면 안 된다. 설정이 없으면 아무 일도 하지 않는 쪽이 맞다.
 *
 * ⚠️ 이 파일은 **의도적으로 아무것도 import 하지 않는다.** Deno 전용 임포트가
 *    하나라도 있으면 Jest 에서 불러올 수 없어 검증이 불가능해진다.
 */

export type CronAuthResult =
  | { ok: true }
  | {
      ok: false;
      /** 응답 상태 코드 */
      status: 401 | 500;
      /** 클라이언트에 돌려줄 메시지 — 내부 사정을 흘리지 않는다 */
      error: string;
      /** 서버 로그에 남길 이유 */
      log: string;
    };

/**
 * 요청이 정당한 cron 호출인지 판단한다.
 *
 * @param provided   요청의 `x-cron-secret` 헤더 값
 * @param configured `CRON_SECRET` 환경변수 값
 */
export function checkCronAuth(
  provided: string | null | undefined,
  configured: string | null | undefined,
): CronAuthResult {
  // 설정 누락은 401 이 아니라 500 이다. 401 로 답하면 "시크릿이 틀렸나" 로
  // 오해하게 되고, 진짜 원인(설정 안 함)을 찾는 데 시간이 든다.
  if (!configured) {
    return {
      ok: false,
      status: 500,
      error: 'Internal server error',
      log: 'CRON_SECRET is not configured — refusing to run',
    };
  }

  if (!timingSafeEqual(provided ?? '', configured)) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
      log: 'Cron secret mismatch',
    };
  }

  return { ok: true };
}

/**
 * 길이와 내용을 상수 시간에 비교한다.
 *
 * `a !== b` 는 첫 다른 바이트에서 멈추므로 걸린 시간이 "몇 글자까지 맞았는지" 를
 * 흘린다. toss-webhook 의 서명 검증과 같은 방식을 쓴다.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  // 길이가 다르면 어차피 불일치지만, 길이 자체가 빨리 새지 않도록 끝까지 돈다.
  let result = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    result |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return result === 0;
}
