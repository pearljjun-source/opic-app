/**
 * 구독 생애주기 테스트 (실행 검증)
 *
 * ⚠️ 이 파일은 subscription-phase6a/6b/6c, quota-enforcement, trend-data 다섯 개를
 *    대체한다. 그것들은 마이그레이션 SQL·Edge Function·화면 소스를 readFileSync 로
 *    읽어 문자열을 대조했고, 계산 로직은 테스트 안에 다시 구현해 그 복사본을
 *    검증했다. 실제 코드를 바꿔도 통과하는 테스트였다.
 *
 *    지금은 역할을 나눴다.
 *    · 마이그레이션 객체가 DB 에 있는지  → npm run check:schema (CI 매일)
 *    · 금액·기간 계산                    → billing-math.test.ts (실제 모듈 호출)
 *    · 타입 필드 존재                    → tsc (컴파일 시점에 이미 강제된다)
 *    · 서비스 동작                       → 이 파일
 *
 * 화면(CancellationFlow 모달, 플랜 토글)은 컴포넌트 테스트 영역이라 뺐다.
 */

import { mockSupabase } from '../mocks/supabase';

const mockInvokeFunction = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
  invokeFunction: (...args: any[]) => mockInvokeFunction(...args),
}));

(global as any).__DEV__ = true;
jest.spyOn(console, 'warn').mockImplementation(() => {});

import { submitCancellationFlow } from '@/services/billing';
import { ERROR_CODES, ERROR_MESSAGES, classifyRpcError } from '@/lib/errors';
import { CANCELLATION_REASONS, PAID_PLAN_KEYS, ALL_PLAN_KEYS } from '@/lib/constants';

const mockChain = mockSupabase._mockChain;
const mockUser = { id: 'owner-1', email: 'owner@test.com' };

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
  // cancellation_feedback insert 는 체인 끝에서 await 된다
  mockChain.insert.mockResolvedValue({ error: null });
});

// ============================================================================
// 취소 리텐션 플로우
// ============================================================================

describe('submitCancellationFlow — 사유 기록', () => {
  it('선택한 사유와 제안 수락 여부를 남긴다', async () => {
    mockChain.insert.mockResolvedValueOnce({ error: null });

    await submitCancellationFlow({
      subscriptionId: 'sub-1',
      orgId: 'org-1',
      reason: 'too_expensive',
      detail: '가격이 부담됩니다',
      offerShown: 'discount_20',
      offerAccepted: false,
      action: 'retained',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('cancellation_feedback');
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        subscription_id: 'sub-1',
        user_id: mockUser.id,
        reason: 'too_expensive',
        detail: '가격이 부담됩니다',
        offer_shown: 'discount_20',
        offer_accepted: false,
        final_action: 'retained',
      }),
    );
  });

  it('사유 기록이 실패해도 취소 자체를 막지 않는다 — 피드백은 부가 정보다', async () => {
    mockChain.insert.mockResolvedValueOnce({ error: { message: 'insert failed' } });

    const { data, error } = await submitCancellationFlow({
      subscriptionId: 'sub-1',
      orgId: 'org-1',
      reason: 'other',
      offerAccepted: true,
      action: 'retained',
    });

    expect(error).toBeNull();
    expect(data).toEqual({ success: true, action: 'retained' });
  });

  it('로그인이 없으면 아무것도 기록하지 않는다', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { data, error } = await submitCancellationFlow({
      subscriptionId: 'sub-1',
      orgId: 'org-1',
      reason: 'other',
      offerAccepted: false,
      action: 'canceled',
    });

    expect(data).toBeNull();
    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockChain.insert).not.toHaveBeenCalled();
  });
});

describe('submitCancellationFlow — 분기', () => {
  it('retained: 아무 결제 API 도 부르지 않는다', async () => {
    const { data } = await submitCancellationFlow({
      subscriptionId: 'sub-1',
      orgId: 'org-1',
      reason: 'other',
      offerAccepted: true,
      action: 'retained',
    });

    expect(data?.action).toBe('retained');
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });

  it('downgraded: free 플랜으로 change-plan 을 부른다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: { success: true, type: 'downgrade' },
      error: null,
    });

    const { data, error } = await submitCancellationFlow({
      subscriptionId: 'sub-1',
      orgId: 'org-1',
      reason: 'too_expensive',
      offerAccepted: true,
      action: 'downgraded',
    });

    expect(error).toBeNull();
    expect(data?.action).toBe('downgraded');
    expect(mockInvokeFunction).toHaveBeenCalledWith('change-plan', {
      newPlanKey: 'free',
      orgId: 'org-1',
    });
  });

  it('downgraded: change-plan 이 실패하면 성공으로 돌려주지 않는다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: null,
      error: new Error('사용량이 free 한도를 넘습니다'),
    });

    const { data, error } = await submitCancellationFlow({
      subscriptionId: 'sub-1',
      orgId: 'org-1',
      reason: 'too_expensive',
      offerAccepted: true,
      action: 'downgraded',
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 쿼터 초과 에러 매핑 (043)
//
// 서버 트리거·RPC 가 돌려주는 문자열이 화면에 보여줄 문구로 이어지는지 본다.
// 매핑이 빠지면 사용자는 "알 수 없는 오류" 를 보게 된다.
// ============================================================================

describe('쿼터 초과 에러', () => {
  it('학생 수 초과가 플랜 한도 안내로 이어진다', () => {
    const err = classifyRpcError('STUDENT_QUOTA_EXCEEDED', { resource: 'invite' });

    expect(err.code).toBe(ERROR_CODES.BILLING_QUOTA_EXCEEDED);
    expect(err.userMessage).toBe(ERROR_MESSAGES[ERROR_CODES.BILLING_QUOTA_EXCEEDED]);
  });

  it('스크립트 수 초과도 같은 안내로 이어진다', () => {
    expect(classifyRpcError('SCRIPT_QUOTA_EXCEEDED', { resource: 'script' }).code)
      .toBe(ERROR_CODES.BILLING_QUOTA_EXCEEDED);
  });

  it('일반 QUOTA_EXCEEDED 도 매핑된다', () => {
    expect(classifyRpcError('QUOTA_EXCEEDED', { resource: 'script' }).code)
      .toBe(ERROR_CODES.BILLING_QUOTA_EXCEEDED);
  });

  it('안내 문구가 업그레이드 경로를 알려준다', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.BILLING_QUOTA_EXCEEDED]).toContain('업그레이드');
  });
});

// ============================================================================
// 상수 — 화면과 DB 가 같은 값을 쓰는지
// ============================================================================

describe('취소 사유 상수', () => {
  it('사유마다 라벨과 리텐션 제안이 있다', () => {
    expect(CANCELLATION_REASONS.length).toBeGreaterThan(0);
    for (const r of CANCELLATION_REASONS) {
      expect(r.key).toBeTruthy();
      expect(r.label).toBeTruthy();
      expect(r.offer).toBeTruthy();
    }
  });

  it('사유 키가 중복되지 않는다', () => {
    const keys = CANCELLATION_REASONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('플랜 키 상수', () => {
  it('유료 플랜에 free 가 섞이지 않는다 (결제 검증이 이 목록을 쓴다)', () => {
    expect(PAID_PLAN_KEYS).not.toContain('free');
  });

  it('전체 플랜은 유료 플랜을 모두 포함하고 free 를 더한 것이다', () => {
    for (const key of PAID_PLAN_KEYS) {
      expect(ALL_PLAN_KEYS).toContain(key);
    }
    expect(ALL_PLAN_KEYS).toContain('free');
    expect(ALL_PLAN_KEYS.length).toBe(PAID_PLAN_KEYS.length + 1);
  });
});
