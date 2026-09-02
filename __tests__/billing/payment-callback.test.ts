/**
 * 결제 콜백 플로우 테스트 (실행 검증)
 *
 * ⚠️ 이 파일은 원래 소스 파일을 readFileSync로 읽어 문자열을 대조했다.
 *    그 방식은 (1) 리팩터링하면 깨지고 (2) 실제 버그는 못 잡는다 —
 *    076·077 마이그레이션이 DB에 없는 상태에서도 전체 테스트가 통과했던 것이 그 증거다.
 *    지금은 실제 함수를 호출해 반환값을 확인한다.
 *
 * 검증 대상:
 * 1. PAYMENT_CALLBACK 상수의 실제 값 (Toss에 등록되는 리다이렉트 경로)
 * 2. buildPaymentUrls → parsePaymentCallbackParams 왕복 (URL 계약)
 * 3. cleanPaymentUrlParams — authKey가 주소창에 남지 않는다
 * 4. 콜백이 호출하는 서비스: issueBillingKey / updateBillingKey / changePlan
 *
 * 화면(payment-callback.tsx)의 마운트 1회·중복 방지 동작은 컴포넌트 테스트 영역이다.
 * CLAUDE.md "테스트 로드맵" 3단계에서 @testing-library/react-native 도입 후 다룬다.
 */

import { Platform } from 'react-native';

import { mockSupabase } from '../mocks/supabase';

const mockInvokeFunction = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
  invokeFunction: (...args: any[]) => mockInvokeFunction(...args),
}));

(global as any).__DEV__ = true;
jest.spyOn(console, 'warn').mockImplementation(() => {});

import { PAYMENT_CALLBACK } from '@/lib/constants';
import {
  buildPaymentUrls,
  parsePaymentCallbackParams,
  cleanPaymentUrlParams,
} from '@/lib/toss';
import { issueBillingKey, updateBillingKey, changePlan } from '@/services/billing';
import { ERROR_CODES } from '@/lib/errors';

// ============================================================================
// 테스트 환경 — 웹 플랫폼 + window.location
// ============================================================================

const originalOS = Platform.OS;
const ORIGIN = 'https://speaky.co.kr';

function mockPlatformOS(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

function mockLocation(href: string) {
  const url = new URL(href);
  Object.defineProperty(window, 'location', {
    value: { origin: url.origin, href, pathname: url.pathname },
    writable: true,
    configurable: true,
  });
}

const mockUser = { id: 'user-1', email: 'teacher@test.com' };

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformOS('web');
  mockLocation(`${ORIGIN}/`);
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true });
});

// ============================================================================
// 1. PAYMENT_CALLBACK 상수
//    Toss 콘솔·URL 빌더·콜백 화면이 같은 값을 봐야 한다
// ============================================================================

describe('PAYMENT_CALLBACK 상수', () => {
  it('콜백 경로가 전용 라우트를 가리킨다', () => {
    expect(PAYMENT_CALLBACK.PATH).toBe('/(teacher)/manage/payment-callback');
  });

  it('액션 값이 두 결제 진입점과 일치한다', () => {
    expect(PAYMENT_CALLBACK.ACTIONS.NEW_SUBSCRIPTION).toBe('new-subscription');
    expect(PAYMENT_CALLBACK.ACTIONS.UPDATE_BILLING).toBe('update-billing');
  });

  it('상태 값 3종이 정의되어 있다', () => {
    expect(PAYMENT_CALLBACK.STATUS.SUCCESS).toBe('success');
    expect(PAYMENT_CALLBACK.STATUS.FAIL).toBe('fail');
    expect(PAYMENT_CALLBACK.STATUS.PROCESSING).toBe('processing');
  });
});

// ============================================================================
// 2. URL 계약 — buildPaymentUrls가 쓴 것을 parsePaymentCallbackParams가 읽는다
//
//    이 왕복이 깨지면 결제는 성공했는데 앱은 "결제 정보를 찾을 수 없습니다"를
//    띄운다. 한쪽 키만 바꾸는 사고가 가장 흔하므로 왕복으로 검증한다.
// ============================================================================

describe('결제 URL 왕복 — 신규 구독', () => {
  it('successUrl을 파싱하면 action·planKey가 복원된다', () => {
    const urls = buildPaymentUrls({ action: 'new-subscription', planKey: 'pro' });
    expect(urls).not.toBeNull();

    const parsed = parsePaymentCallbackParams(urls!.successUrl);
    expect(parsed.action).toBe(PAYMENT_CALLBACK.ACTIONS.NEW_SUBSCRIPTION);
    expect(parsed.planKey).toBe('pro');
    expect(parsed.status).toBeNull();
  });

  it('successUrl이 콜백 라우트를 가리킨다', () => {
    const urls = buildPaymentUrls({ action: 'new-subscription', planKey: 'pro' });
    expect(new URL(urls!.successUrl).pathname).toBe(PAYMENT_CALLBACK.PATH);
    expect(urls!.successUrl.startsWith(ORIGIN)).toBe(true);
  });

  it('연간 결제는 cycle=yearly로 왕복된다', () => {
    const urls = buildPaymentUrls({ action: 'new-subscription', planKey: 'pro', cycle: 'yearly' });
    expect(parsePaymentCallbackParams(urls!.successUrl).cycle).toBe('yearly');
  });

  it('월간은 cycle 파라미터 없이도 monthly로 읽힌다 (기본값)', () => {
    const urls = buildPaymentUrls({ action: 'new-subscription', planKey: 'solo', cycle: 'monthly' });
    expect(urls!.successUrl).not.toContain('cycle=');
    expect(parsePaymentCallbackParams(urls!.successUrl).cycle).toBe('monthly');
  });
});

describe('결제 URL 왕복 — 결제수단 변경', () => {
  it('action이 update-billing으로 복원되고 planKey는 없다', () => {
    const urls = buildPaymentUrls({ action: 'update-billing' });
    const parsed = parsePaymentCallbackParams(urls!.successUrl);

    expect(parsed.action).toBe(PAYMENT_CALLBACK.ACTIONS.UPDATE_BILLING);
    expect(parsed.planKey).toBeNull();
  });
});

describe('결제 URL 왕복 — 실패 콜백', () => {
  it('failUrl은 status=fail로 파싱되어 에러 분기로 간다', () => {
    const urls = buildPaymentUrls({ action: 'new-subscription', planKey: 'pro' });
    const parsed = parsePaymentCallbackParams(urls!.failUrl);

    expect(parsed.status).toBe(PAYMENT_CALLBACK.STATUS.FAIL);
    expect(parsed.action).toBe(PAYMENT_CALLBACK.ACTIONS.NEW_SUBSCRIPTION);
  });

  it('Toss가 붙여 보내는 message를 읽는다', () => {
    const parsed = parsePaymentCallbackParams(
      `${ORIGIN}${PAYMENT_CALLBACK.PATH}?status=fail&action=new-subscription&message=${encodeURIComponent('사용자가 취소했습니다')}`,
    );
    expect(parsed.message).toBe('사용자가 취소했습니다');
  });
});

describe('parsePaymentCallbackParams — 비정상 입력', () => {
  it('Toss가 붙여주는 authKey·customerKey를 읽는다', () => {
    const parsed = parsePaymentCallbackParams(
      `${ORIGIN}${PAYMENT_CALLBACK.PATH}?action=new-subscription&planKey=pro&authKey=auth_abc&customerKey=user-1`,
    );
    expect(parsed.authKey).toBe('auth_abc');
    expect(parsed.customerKey).toBe('user-1');
  });

  it('파라미터가 없으면 전부 null이다 (새로고침 → 에러 화면)', () => {
    const parsed = parsePaymentCallbackParams(`${ORIGIN}${PAYMENT_CALLBACK.PATH}`);
    expect(parsed.action).toBeNull();
    expect(parsed.authKey).toBeNull();
  });

  it('URL이 깨져 있어도 던지지 않는다', () => {
    expect(() => parsePaymentCallbackParams('not-a-url')).not.toThrow();
    expect(parsePaymentCallbackParams('not-a-url').action).toBeNull();
  });

  it('네이티브에서는 window 없이도 빈 값을 돌려준다', () => {
    mockPlatformOS('ios');
    expect(parsePaymentCallbackParams().action).toBeNull();
    expect(parsePaymentCallbackParams().cycle).toBe('monthly');
  });

  it('cycle에 이상한 값이 와도 monthly로 떨어진다', () => {
    const parsed = parsePaymentCallbackParams(
      `${ORIGIN}${PAYMENT_CALLBACK.PATH}?action=new-subscription&cycle=weekly`,
    );
    expect(parsed.cycle).toBe('monthly');
  });
});

describe('buildPaymentUrls — 네이티브', () => {
  it('웹이 아니면 null을 돌려준다', () => {
    mockPlatformOS('ios');
    expect(buildPaymentUrls({ action: 'new-subscription', planKey: 'pro' })).toBeNull();
  });
});

// ============================================================================
// 3. URL 정리 — authKey가 주소창에 남으면 안 된다
//    (CLAUDE.md 보안 원칙: "URL 토큰 잔존 → 토큰 추출 즉시 제거")
// ============================================================================

describe('cleanPaymentUrlParams', () => {
  it('웹에서 쿼리스트링을 제거한다 — authKey가 주소에 남지 않는다', () => {
    const replaceState = jest.fn();
    Object.defineProperty(window, 'history', {
      value: { replaceState },
      writable: true,
      configurable: true,
    });
    mockLocation(`${ORIGIN}${PAYMENT_CALLBACK.PATH}?action=new-subscription&authKey=auth_secret`);

    cleanPaymentUrlParams();

    expect(replaceState).toHaveBeenCalledTimes(1);
    const newUrl = replaceState.mock.calls[0][2] as string;
    expect(newUrl).toBe(PAYMENT_CALLBACK.PATH);
    expect(newUrl).not.toContain('authKey');
  });

  it('네이티브에서는 아무것도 하지 않는다', () => {
    const replaceState = jest.fn();
    Object.defineProperty(window, 'history', {
      value: { replaceState },
      writable: true,
      configurable: true,
    });
    mockPlatformOS('ios');

    cleanPaymentUrlParams();

    expect(replaceState).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 4. 콜백이 호출하는 서비스 — 실제 호출/에러 경로
// ============================================================================

describe('issueBillingKey — 신규 구독 경로', () => {
  // 시그니처: issueBillingKey(planKey, authKey, orgId, billingCycle)
  it('billing-key Edge Function에 planKey·authKey·orgId·주기를 넘긴다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: { subscriptionId: 'sub-1' }, error: null });

    await issueBillingKey('pro', 'auth_abc', 'org-1', 'yearly');

    expect(mockInvokeFunction).toHaveBeenCalledTimes(1);
    const [fnName, payload] = mockInvokeFunction.mock.calls[0];
    expect(fnName).toBe('billing-key');
    expect(payload).toMatchObject({
      planKey: 'pro',
      authKey: 'auth_abc',
      orgId: 'org-1',
      billingCycle: 'yearly',
    });
  });

  it('주기를 생략하면 monthly로 나간다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: { subscriptionId: 'sub-1' }, error: null });

    await issueBillingKey('solo', 'auth_abc', 'org-1');

    expect(mockInvokeFunction.mock.calls[0][1]).toMatchObject({ billingCycle: 'monthly' });
  });

  it('authKey가 비면 Edge Function을 부르지 않는다 (결제 요청 낭비 방지)', async () => {
    const { error } = await issueBillingKey('pro', '', 'org-1');

    expect(error).not.toBeNull();
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });

  it('무료 플랜 키는 결제 대상이 아니므로 거부한다', async () => {
    const { error } = await issueBillingKey('free', 'auth_abc', 'org-1');

    expect((error as any)?.code).toBe(ERROR_CODES.VAL_FAILED);
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });

  it('orgId가 비면 부르지 않는다', async () => {
    const { error } = await issueBillingKey('pro', 'auth_abc', '');

    expect((error as any)?.code).toBe(ERROR_CODES.VAL_FAILED);
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });

  it('로그인이 없으면 AUTH_REQUIRED', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { data, error } = await issueBillingKey('pro', 'auth_abc', 'org-1');

    expect(data).toBeNull();
    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });

  it('Edge Function 실패를 그대로 삼키지 않는다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: null, error: new Error('카드 등록 실패') });

    const { data, error } = await issueBillingKey('pro', 'auth_abc', 'org-1');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('타임아웃은 NETWORK_TIMEOUT으로 구분한다 — 결제가 성공했을 수 있어 안내가 달라야 한다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: null, error: new Error('request timeout') });

    const { error } = await issueBillingKey('pro', 'auth_abc', 'org-1');

    expect((error as any)?.code).toBe(ERROR_CODES.NETWORK_TIMEOUT);
  });
});

describe('updateBillingKey — 결제수단 변경 경로', () => {
  it('update-billing-key Edge Function에 authKey·orgId를 넘긴다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: { success: true }, error: null });

    const { data, error } = await updateBillingKey('auth_new', 'org-1');

    expect(error).toBeNull();
    expect(data).toEqual({ success: true });
    expect(mockInvokeFunction).toHaveBeenCalledWith('update-billing-key', {
      authKey: 'auth_new',
      orgId: 'org-1',
    });
  });

  it('orgId가 비면 호출하지 않는다', async () => {
    const { error } = await updateBillingKey('auth_new', '');

    expect(error).not.toBeNull();
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });

  it('로그인이 없으면 AUTH_REQUIRED', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { error } = await updateBillingKey('auth_new', 'org-1');

    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });

  it('Edge Function 실패 시 success를 돌려주지 않는다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: null, error: new Error('빌링키 재발급 실패') });

    const { data, error } = await updateBillingKey('auth_new', 'org-1');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe('changePlan — Toss 리다이렉트 없이 직접 처리되는 경로', () => {
  it('change-plan Edge Function에 newPlanKey·orgId를 넘긴다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: { success: true, type: 'upgrade', proratedAmount: 30000 },
      error: null,
    });

    const { data, error } = await changePlan('academy', 'org-1');

    expect(error).toBeNull();
    expect(data).toMatchObject({ type: 'upgrade', proratedAmount: 30000 });
    expect(mockInvokeFunction).toHaveBeenCalledWith('change-plan', {
      newPlanKey: 'academy',
      orgId: 'org-1',
    });
  });

  it('다운그레이드 응답을 그대로 전달한다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: { success: true, type: 'downgrade' },
      error: null,
    });

    const { data } = await changePlan('solo', 'org-1');

    expect(data?.type).toBe('downgrade');
  });

  it('플랜 키가 비면 호출하지 않는다', async () => {
    const { error } = await changePlan('', 'org-1');

    expect(error).not.toBeNull();
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });

  it('Edge Function 실패를 전달한다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: null, error: new Error('사용량 초과') });

    const { data, error } = await changePlan('solo', 'org-1');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 5. 시나리오 — 진입점에서 만든 URL이 콜백에서 올바른 서비스로 이어지는가
// ============================================================================

describe('시나리오: 신규 구독 (plan-select → Toss → 콜백)', () => {
  it('URL을 만들고 파싱한 값으로 issueBillingKey가 호출된다', async () => {
    // ① plan-select가 URL을 만든다
    const urls = buildPaymentUrls({ action: 'new-subscription', planKey: 'pro', cycle: 'yearly' });

    // ② Toss가 authKey를 붙여 successUrl로 되돌려보낸다
    const returned = `${urls!.successUrl}&authKey=auth_from_toss&customerKey=user-1`;

    // ③ 콜백이 파싱한다
    const p = parsePaymentCallbackParams(returned);
    expect(p.action).toBe(PAYMENT_CALLBACK.ACTIONS.NEW_SUBSCRIPTION);

    // ④ 파싱한 값으로 서비스를 부른다
    mockInvokeFunction.mockResolvedValueOnce({ data: { subscriptionId: 'sub-1' }, error: null });
    await issueBillingKey(p.planKey!, p.authKey!, 'org-1', p.cycle);

    expect(mockInvokeFunction).toHaveBeenCalledWith('billing-key', expect.objectContaining({
      authKey: 'auth_from_toss',
      planKey: 'pro',
      billingCycle: 'yearly',
    }));
  });
});

describe('시나리오: 결제수단 변경 (subscription → Toss → 콜백)', () => {
  it('URL을 만들고 파싱한 값으로 updateBillingKey가 호출된다', async () => {
    const urls = buildPaymentUrls({ action: 'update-billing' });
    const returned = `${urls!.successUrl}&authKey=auth_update&customerKey=user-1`;

    const p = parsePaymentCallbackParams(returned);
    expect(p.action).toBe(PAYMENT_CALLBACK.ACTIONS.UPDATE_BILLING);

    mockInvokeFunction.mockResolvedValueOnce({ data: { success: true }, error: null });
    await updateBillingKey(p.authKey!, 'org-1');

    expect(mockInvokeFunction).toHaveBeenCalledWith('update-billing-key', {
      authKey: 'auth_update',
      orgId: 'org-1',
    });
  });
});

describe('시나리오: 새로고침 — URL이 정리된 뒤 재진입', () => {
  it('파라미터가 사라져 authKey가 없으므로 결제가 재실행되지 않는다', async () => {
    const p = parsePaymentCallbackParams(`${ORIGIN}${PAYMENT_CALLBACK.PATH}`);

    expect(p.authKey).toBeNull();
    expect(p.action).toBeNull();

    // 콜백 화면은 이 상태에서 서비스를 부르지 않고 에러를 표시한다
    if (p.action && p.authKey) {
      await issueBillingKey(p.planKey!, p.authKey, 'org-1');
    }
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });
});
