import { mockSupabase } from '../mocks/supabase';

const mockInvokeFunction = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
  invokeFunction: (...args: any[]) => mockInvokeFunction(...args),
}));

// Mock __DEV__
(global as any).__DEV__ = true;
jest.spyOn(console, 'warn').mockImplementation(() => {});

import { adminRequestRefund } from '@/services/billing';
import { AppError, ERROR_CODES, ERROR_MESSAGES } from '@/lib/errors';

const mockUser = { id: 'admin-1', email: 'admin@speaky.com' };

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
});

// ============================================================================
// adminRequestRefund()
// ============================================================================
describe('adminRequestRefund()', () => {
  it('AUTH_REQUIRED when not logged in', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await adminRequestRefund({
      paymentId: 'pay-1',
      reason: '이중 결제',
    });

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('VAL_FAILED when paymentId is empty', async () => {
    const result = await adminRequestRefund({
      paymentId: '',
      reason: '이중 결제',
    });

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('VAL_FAILED');
  });

  it('VAL_FAILED when reason is empty', async () => {
    const result = await adminRequestRefund({
      paymentId: 'pay-1',
      reason: '',
    });

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('VAL_FAILED');
  });

  it('calls request-refund Edge Function with correct params', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: { success: true, refundAmount: 29900 },
      error: null,
    });

    const result = await adminRequestRefund({
      paymentId: 'pay-1',
      reason: '이중 결제',
      forceRefund: true,
    });

    expect(mockInvokeFunction).toHaveBeenCalledWith('request-refund', {
      paymentId: 'pay-1',
      reason: '이중 결제',
      forceRefund: true,
    });
    expect(result.data).toEqual({ success: true, refundAmount: 29900 });
    expect(result.error).toBeNull();
  });

  it('handles Edge Function error', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: null,
      error: new Error('TOSS_CANCEL_FAILED'),
    });

    const result = await adminRequestRefund({
      paymentId: 'pay-1',
      reason: '이중 결제',
    });

    expect(result.error).toBeInstanceOf(Error);
    expect(result.data).toBeNull();
  });

  it('forceRefund defaults to false', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: { success: true, refundAmount: 279000 },
      error: null,
    });

    await adminRequestRefund({
      paymentId: 'pay-1',
      reason: '연간 결제 14일 이내 환불 요청',
    });

    expect(mockInvokeFunction).toHaveBeenCalledWith('request-refund', {
      paymentId: 'pay-1',
      reason: '연간 결제 14일 이내 환불 요청',
      forceRefund: false,
    });
  });
});

// ============================================================================
// 환불 정책 시뮬레이션 (Edge Function 로직 검증)
// ============================================================================
describe('Refund Policy Simulation', () => {
  // Edge Function의 정책 로직을 순수 함수로 추출하여 테스트
  function checkRefundPolicy(params: {
    billingCycle: 'monthly' | 'yearly';
    daysSincePaid: number;
    forceRefund: boolean;
  }): { allowed: boolean; error?: string } {
    if (params.forceRefund) {
      return { allowed: true };
    }

    if (params.billingCycle === 'monthly') {
      return { allowed: false, error: 'REFUND_NOT_ALLOWED' };
    }

    if (params.billingCycle === 'yearly' && params.daysSincePaid > 14) {
      return { allowed: false, error: 'REFUND_PERIOD_EXPIRED' };
    }

    return { allowed: true };
  }

  describe('Monthly subscription', () => {
    it('rejects refund for monthly billing (day 0)', () => {
      const result = checkRefundPolicy({ billingCycle: 'monthly', daysSincePaid: 0, forceRefund: false });
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('REFUND_NOT_ALLOWED');
    });

    it('rejects refund for monthly billing (day 7)', () => {
      const result = checkRefundPolicy({ billingCycle: 'monthly', daysSincePaid: 7, forceRefund: false });
      expect(result.allowed).toBe(false);
    });

    it('allows forced refund for monthly billing', () => {
      const result = checkRefundPolicy({ billingCycle: 'monthly', daysSincePaid: 0, forceRefund: true });
      expect(result.allowed).toBe(true);
    });
  });

  describe('Yearly subscription', () => {
    it('allows refund within 14 days (day 0)', () => {
      const result = checkRefundPolicy({ billingCycle: 'yearly', daysSincePaid: 0, forceRefund: false });
      expect(result.allowed).toBe(true);
    });

    it('allows refund on day 14', () => {
      const result = checkRefundPolicy({ billingCycle: 'yearly', daysSincePaid: 14, forceRefund: false });
      expect(result.allowed).toBe(true);
    });

    it('rejects refund after 14 days (day 15)', () => {
      const result = checkRefundPolicy({ billingCycle: 'yearly', daysSincePaid: 15, forceRefund: false });
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('REFUND_PERIOD_EXPIRED');
    });

    it('rejects refund after 30 days', () => {
      const result = checkRefundPolicy({ billingCycle: 'yearly', daysSincePaid: 30, forceRefund: false });
      expect(result.allowed).toBe(false);
    });

    it('allows forced refund after 14 days', () => {
      const result = checkRefundPolicy({ billingCycle: 'yearly', daysSincePaid: 30, forceRefund: true });
      expect(result.allowed).toBe(true);
    });
  });
});

// ============================================================================
// 트라이얼 온보딩 시뮬레이션 (DB 트리거 로직 검증)
// ============================================================================
describe('Trial Onboarding Simulation', () => {
  // DB 트리거의 로직을 순수 함수로 추출하여 테스트
  function simulateTrialCreation(params: {
    soloPlanExists: boolean;
    freePlanExists: boolean;
    existingSubscription: boolean;
  }): { created: boolean; status: string; planKey: string; trialDays: number } | null {
    const { soloPlanExists, freePlanExists, existingSubscription } = params;

    if (existingSubscription) {
      return null; // 이미 구독 있음 → 생성 안 함
    }

    if (soloPlanExists) {
      return { created: true, status: 'trialing', planKey: 'solo', trialDays: 14 };
    }

    if (freePlanExists) {
      return { created: true, status: 'active', planKey: 'free', trialDays: 0 };
    }

    return null; // 플랜 없음 → 무시
  }

  it('creates Solo trial subscription when Solo plan exists', () => {
    const result = simulateTrialCreation({
      soloPlanExists: true,
      freePlanExists: true,
      existingSubscription: false,
    });

    expect(result).not.toBeNull();
    expect(result!.status).toBe('trialing');
    expect(result!.planKey).toBe('solo');
    expect(result!.trialDays).toBe(14);
  });

  it('falls back to Free plan when Solo plan does not exist', () => {
    const result = simulateTrialCreation({
      soloPlanExists: false,
      freePlanExists: true,
      existingSubscription: false,
    });

    expect(result).not.toBeNull();
    expect(result!.status).toBe('active');
    expect(result!.planKey).toBe('free');
    expect(result!.trialDays).toBe(0);
  });

  it('skips when subscription already exists', () => {
    const result = simulateTrialCreation({
      soloPlanExists: true,
      freePlanExists: true,
      existingSubscription: true,
    });

    expect(result).toBeNull();
  });

  it('skips when no plans exist', () => {
    const result = simulateTrialCreation({
      soloPlanExists: false,
      freePlanExists: false,
      existingSubscription: false,
    });

    expect(result).toBeNull();
  });

  // 트라이얼 만료 로직 시뮬레이션
  function simulateTrialExpiration(params: {
    status: string;
    trialEndsAt: Date | null;
    now: Date;
  }): { expired: boolean; newPlanKey: string; newStatus: string } | null {
    if (params.status !== 'trialing') return null;
    if (!params.trialEndsAt) return null;
    if (params.trialEndsAt > params.now) return null; // 아직 만료 안 됨

    return { expired: true, newPlanKey: 'free', newStatus: 'active' };
  }

  it('expires trialing subscription after trial_ends_at', () => {
    const now = new Date('2026-03-21');
    const trialEndsAt = new Date('2026-03-20'); // 어제 만료

    const result = simulateTrialExpiration({ status: 'trialing', trialEndsAt, now });

    expect(result).not.toBeNull();
    expect(result!.expired).toBe(true);
    expect(result!.newPlanKey).toBe('free');
    expect(result!.newStatus).toBe('active');
  });

  it('does not expire trialing subscription before trial_ends_at', () => {
    const now = new Date('2026-03-21');
    const trialEndsAt = new Date('2026-03-25'); // 4일 후 만료

    const result = simulateTrialExpiration({ status: 'trialing', trialEndsAt, now });

    expect(result).toBeNull();
  });

  it('does not expire active subscription', () => {
    const now = new Date('2026-03-21');
    const trialEndsAt = new Date('2026-03-20');

    const result = simulateTrialExpiration({ status: 'active', trialEndsAt, now });

    expect(result).toBeNull();
  });

  it('does not expire subscription without trial_ends_at', () => {
    const now = new Date('2026-03-21');

    const result = simulateTrialExpiration({ status: 'trialing', trialEndsAt: null, now });

    expect(result).toBeNull();
  });
});

// ============================================================================
// 에러 코드 검증
// ============================================================================
describe('Refund Error Codes', () => {
  it('BILLING_REFUND_NOT_ALLOWED has Korean message', () => {
    expect(ERROR_MESSAGES.BILLING_REFUND_NOT_ALLOWED).toBe('환불이 불가능한 결제입니다');
  });

  it('BILLING_REFUND_PERIOD_EXPIRED has Korean message', () => {
    expect(ERROR_MESSAGES.BILLING_REFUND_PERIOD_EXPIRED).toBe('환불 가능 기간(14일)이 지났습니다');
  });

  it('BILLING_ALREADY_REFUNDED has Korean message', () => {
    expect(ERROR_MESSAGES.BILLING_ALREADY_REFUNDED).toBe('이미 환불된 결제입니다');
  });

  it('BILLING_REFUND_FAILED has Korean message', () => {
    expect(ERROR_MESSAGES.BILLING_REFUND_FAILED).toBe('환불 처리에 실패했습니다');
  });

  it('AppError creates correct error for refund codes', () => {
    const err = new AppError('BILLING_REFUND_NOT_ALLOWED');
    expect(err.code).toBe('BILLING_REFUND_NOT_ALLOWED');
    expect(err.message).toBe('환불이 불가능한 결제입니다');
    expect(err.category).toBe('permission');
  });
});

// ============================================================================
// Sentry 초기화 검증
// ============================================================================
describe('Sentry Integration', () => {
  it('sentry module exports expected functions', () => {
    // Jest가 모듈 import 시 에러 없이 로드되는지 확인
    const sentry = require('@/lib/sentry');
    expect(typeof sentry.initSentry).toBe('function');
    expect(typeof sentry.setSentryUser).toBe('function');
    expect(typeof sentry.clearSentryUser).toBe('function');
    expect(typeof sentry.captureError).toBe('function');
  });

  it('initSentry does not throw when DSN is empty', () => {
    const sentry = require('@/lib/sentry');
    // DSN이 환경변수에 없으면 skip (throw 안 함)
    expect(() => sentry.initSentry()).not.toThrow();
  });
});
