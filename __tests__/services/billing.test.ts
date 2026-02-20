import { mockSupabase } from '../mocks/supabase';
import { AppError, ERROR_MESSAGES } from '@/lib/errors';

// jest.mock 호이스팅 문제 해결: require()는 런타임에 실행되므로 안전
jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
}));

// Mock __DEV__
(global as any).__DEV__ = true;
jest.spyOn(console, 'warn').mockImplementation(() => {});

// Import AFTER mocking
import {
  getSubscriptionPlans,
  getMySubscription,
  issueBillingKey,
  cancelSubscription,
  getPaymentHistory,
  checkFeatureAccess,
  getRemainingQuota,
} from '@/services/billing';

const mockChain = mockSupabase._mockChain;
const mockUser = { id: 'user-1', email: 'test@test.com' };

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
});

// ============================================================================
// getSubscriptionPlans()
// ============================================================================
describe('getSubscriptionPlans()', () => {
  it('returns plans on success', async () => {
    const plans = [{ id: 'p1', plan_key: 'free' }, { id: 'p2', plan_key: 'pro' }];
    mockChain.order.mockResolvedValueOnce({ data: plans, error: null });

    const result = await getSubscriptionPlans();

    expect(result.data).toEqual(plans);
    expect(result.error).toBeNull();
  });

  it('returns error on Supabase error', async () => {
    mockChain.order.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Permission denied' },
    });

    const result = await getSubscriptionPlans();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });
});

// ============================================================================
// getMySubscription()
// ============================================================================
describe('getMySubscription()', () => {
  it('returns null without error when no subscription found (PGRST116)', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });

    const result = await getMySubscription('org-1');

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns AUTH_REQUIRED when not logged in', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await getMySubscription();

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('queries by organization_id when orgId provided', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: {
        id: 'sub-1', status: 'active', organization_id: 'org-1',
        subscription_plans: { id: 'p1', plan_key: 'pro' },
      },
      error: null,
    });

    const result = await getMySubscription('org-1');

    // Should have called .eq with organization_id
    expect(mockChain.eq).toHaveBeenCalledWith('organization_id', 'org-1');
    expect(result.data).not.toBeNull();
    expect(result.data!.plan.plan_key).toBe('pro');
  });
});

// ============================================================================
// issueBillingKey()
// ============================================================================
describe('issueBillingKey()', () => {
  it('validates planKey and authKey (rejects empty)', async () => {
    const result = await issueBillingKey('', '', 'org-1');

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('VAL_FAILED');
  });

  it('rejects empty orgId', async () => {
    const result = await issueBillingKey('pro', 'auth-key-123', '');

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('VAL_FAILED');
  });

  it('returns AUTH_REQUIRED when not logged in', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await issueBillingKey('pro', 'auth-key-123', 'org-1');

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('calls billing-key Edge Function with orgId', async () => {
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: { subscriptionId: 'sub-1' },
      error: null,
    });

    const result = await issueBillingKey('pro', 'auth-key-123', 'org-1');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('billing-key', {
      body: { planKey: 'pro', authKey: 'auth-key-123', orgId: 'org-1' },
    });
    expect(result.data).toEqual({ subscriptionId: 'sub-1' });
    expect(result.error).toBeNull();
  });

  it('handles Edge Function error', async () => {
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Internal server error' },
    });

    const result = await issueBillingKey('pro', 'auth-key-123', 'org-1');

    expect(result.error).toBeInstanceOf(Error);
    expect(result.data).toBeNull();
  });

  it('handles Edge Function business error (data.error)', async () => {
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: { error: 'NOT_ORG_OWNER' },
      error: null,
    });

    const result = await issueBillingKey('pro', 'auth-key-123', 'org-1');

    expect(result.error).toBeInstanceOf(Error);
    expect(result.data).toBeNull();
  });
});

// ============================================================================
// cancelSubscription()
// ============================================================================
describe('cancelSubscription()', () => {
  it('AUTH_REQUIRED when not logged in', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await cancelSubscription('sub-1');

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('cancels subscription successfully', async () => {
    // cancelSubscription chain: update → eq → eq → select → single
    // select returns this (chainable), single resolves with data
    mockChain.select.mockReturnThis();
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'sub-1', cancel_at_period_end: true },
      error: null,
    });

    const result = await cancelSubscription('sub-1');

    expect(mockChain.update).toHaveBeenCalled();
    expect(result.data).toEqual({ success: true });
    expect(result.error).toBeNull();
  });
});

// ============================================================================
// checkFeatureAccess()
// ============================================================================
describe('checkFeatureAccess()', () => {
  it('returns allowed: false when not logged in', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await checkFeatureAccess('ai_feedback');

    expect(result.allowed).toBe(false);
  });

  it('calls check_org_entitlement RPC', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { allowed: true, plan_key: 'pro' },
      error: null,
    });

    const result = await checkFeatureAccess('tts');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('check_org_entitlement', { p_feature_key: 'tts' });
    expect(result.allowed).toBe(true);
    expect(result.planKey).toBe('pro');
  });

  it('returns allowed: true on RPC error (fallback — Edge Function checks)', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'function does not exist' },
    });

    const result = await checkFeatureAccess('ai_feedback');

    expect(result.allowed).toBe(true);
  });

  it('returns allowed: false when plan does not have feature', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { allowed: false, plan_key: 'free', reason: 'FREE_PLAN' },
      error: null,
    });

    const result = await checkFeatureAccess('ai_feedback');

    expect(result.allowed).toBe(false);
    expect(result.planKey).toBe('free');
    expect(result.reason).toBe('FREE_PLAN');
  });
});

// ============================================================================
// getRemainingQuota()
// ============================================================================
describe('getRemainingQuota()', () => {
  it('returns quota from RPC', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { allowed: true, used: 2, limit: 10, remaining: 8 },
      error: null,
    });

    const result = await getRemainingQuota('students');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('check_org_entitlement', { p_feature_key: 'max_students' });
    expect(result).toEqual({ allowed: true, used: 2, limit: 10, remaining: 8 });
  });

  it('returns free defaults on RPC error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'network error' },
    });

    const result = await getRemainingQuota('students');

    expect(result.limit).toBe(3); // free default for students
    expect(result.allowed).toBe(true);
  });

  it('uses max_scripts for scripts quota', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { allowed: false, used: 5, limit: 5, remaining: 0 },
      error: null,
    });

    const result = await getRemainingQuota('scripts');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('check_org_entitlement', { p_feature_key: 'max_scripts' });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns free defaults for scripts on RPC error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'error' },
    });

    const result = await getRemainingQuota('scripts');

    expect(result.limit).toBe(5); // free default for scripts
  });

  it('returns allowed: false when not logged in', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await getRemainingQuota('students');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
