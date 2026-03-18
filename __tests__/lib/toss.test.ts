import { Platform } from 'react-native';
import { isTossConfigured, buildPaymentUrls, requestTossBillingAuth, cleanPaymentUrlParams } from '@/lib/toss';

// ============================================================================
// lib/toss.ts 테스트
// ============================================================================

const originalOS = Platform.OS;

function mockPlatformOS(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true });
});

// ============================================================================
// isTossConfigured
// ============================================================================
describe('isTossConfigured', () => {
  it('returns false when TOSS_CLIENT_KEY is empty', () => {
    // Module-level constant reads env at import time; env not set in test
    expect(isTossConfigured()).toBe(false);
  });
});

// ============================================================================
// buildPaymentUrls
// ============================================================================
describe('buildPaymentUrls', () => {
  it('returns null on non-web platform', () => {
    mockPlatformOS('ios');
    expect(buildPaymentUrls({ action: 'new-subscription', planKey: 'pro' })).toBeNull();
  });

  it('returns URLs pointing to payment-callback route on web', () => {
    mockPlatformOS('web');
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test.com' },
      writable: true,
      configurable: true,
    });

    const result = buildPaymentUrls({ action: 'new-subscription', planKey: 'pro' });
    expect(result).not.toBeNull();
    expect(result!.successUrl).toContain('/(teacher)/manage/payment-callback');
    expect(result!.successUrl).toContain('action=new-subscription');
    expect(result!.successUrl).toContain('planKey=pro');
    expect(result!.failUrl).toContain('status=fail');
    expect(result!.failUrl).toContain('action=new-subscription');
  });

  it('includes cycle=yearly when specified', () => {
    mockPlatformOS('web');
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test.com' },
      writable: true,
      configurable: true,
    });

    const result = buildPaymentUrls({ action: 'new-subscription', planKey: 'pro', cycle: 'yearly' });
    expect(result).not.toBeNull();
    expect(result!.successUrl).toContain('cycle=yearly');
  });

  it('omits cycle param when monthly (default)', () => {
    mockPlatformOS('web');
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test.com' },
      writable: true,
      configurable: true,
    });

    const result = buildPaymentUrls({ action: 'new-subscription', planKey: 'solo', cycle: 'monthly' });
    expect(result).not.toBeNull();
    expect(result!.successUrl).not.toContain('cycle=');
  });

  it('builds update-billing URLs correctly', () => {
    mockPlatformOS('web');
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test.com' },
      writable: true,
      configurable: true,
    });

    const result = buildPaymentUrls({ action: 'update-billing' });
    expect(result).not.toBeNull();
    expect(result!.successUrl).toContain('action=update-billing');
    expect(result!.successUrl).not.toContain('planKey');
  });
});

// ============================================================================
// cleanPaymentUrlParams
// ============================================================================
describe('cleanPaymentUrlParams', () => {
  it('does nothing on non-web platform', () => {
    mockPlatformOS('ios');
    // Should not throw
    cleanPaymentUrlParams();
  });
});

// ============================================================================
// requestTossBillingAuth
// ============================================================================
describe('requestTossBillingAuth', () => {
  const params = {
    customerKey: 'user-123',
    successUrl: 'https://example.com/success',
    failUrl: 'https://example.com/fail',
  };

  it('throws on non-web platform', async () => {
    mockPlatformOS('ios');
    await expect(requestTossBillingAuth(params)).rejects.toThrow(
      'Toss SDK는 웹에서만 사용 가능합니다'
    );
  });

  it('throws when TOSS_CLIENT_KEY is not set', async () => {
    mockPlatformOS('web');
    await expect(requestTossBillingAuth(params)).rejects.toThrow(
      '결제 시스템이 설정되지 않았습니다'
    );
  });
});
