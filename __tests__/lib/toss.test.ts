import { Platform } from 'react-native';
import { isTossConfigured, buildPaymentUrls, requestTossBillingAuth } from '@/lib/toss';

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
    expect(buildPaymentUrls('pro')).toBeNull();
  });

  it('returns URLs with planKey on web', () => {
    mockPlatformOS('web');
    // jsdom에서 window.location.origin 설정
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test.com' },
      writable: true,
      configurable: true,
    });

    const result = buildPaymentUrls('pro');
    expect(result).not.toBeNull();
    expect(result!.successUrl).toBe('https://app.test.com/(teacher)/manage/plan-select?planKey=pro');
    expect(result!.failUrl).toBe('https://app.test.com/(teacher)/manage/plan-select?paymentStatus=fail');
  });

  it('encodes special characters in planKey', () => {
    mockPlatformOS('web');
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test.com' },
      writable: true,
      configurable: true,
    });

    const result = buildPaymentUrls('pro & test');
    expect(result).not.toBeNull();
    expect(result!.successUrl).toContain(encodeURIComponent('pro & test'));
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
