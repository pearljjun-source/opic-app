/**
 * 결제 금액·기간 계산 테스트 (실행 검증)
 *
 * ⚠️ 이 테스트들은 원래 subscription-phase6a/6c.test.ts 안에서 수식을
 *    **테스트 파일에 다시 구현해놓고 그 복사본을 검증**하고 있었다.
 *    Edge Function 의 수식을 바꿔도 통과한다 — 돈을 다루는 계산에서 가장 위험한
 *    형태다.
 *
 *    지금은 change-plan / subscription-renew 가 실제로 부르는
 *    supabase/functions/_shared/billing-math.ts 를 그대로 불러 검증한다.
 */

import {
  calculateProration,
  addBillingPeriod,
  priceForCycle,
} from '../../supabase/functions/_shared/billing-math';

// ============================================================================
// 일할 계산 (플랜 변경)
// ============================================================================

describe('calculateProration — 업그레이드', () => {
  it('30일 중 15일 남았으면 차액의 절반', () => {
    const amount = calculateProration({
      currentPrice: 10000,
      newPrice: 30000,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      now: new Date('2026-03-16'),
    });

    expect(amount).toBe(10000); // 20000 * 15/30
  });

  it('기간이 통째로 남았으면 차액 전액', () => {
    const amount = calculateProration({
      currentPrice: 10000,
      newPrice: 30000,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      now: new Date('2026-03-01'),
    });

    expect(amount).toBe(20000);
  });

  it('만료 직전이면 거의 청구하지 않는다', () => {
    const amount = calculateProration({
      currentPrice: 10000,
      newPrice: 30000,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      now: new Date('2026-03-30'),
    });

    expect(amount).toBeLessThanOrEqual(1000);
  });

  it('실제 플랜 가격으로 계산한다 (Solo 49,900 → Pro 99,900, 절반 남음)', () => {
    const amount = calculateProration({
      currentPrice: 49900,
      newPrice: 99900,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      now: new Date('2026-03-16'),
    });

    expect(amount).toBe(25000); // 50000 * 15/30
  });
});

describe('calculateProration — 다운그레이드', () => {
  it('차액이 음수로 나온다 (즉시 환불하지 않고 다음 갱신에 반영)', () => {
    const amount = calculateProration({
      currentPrice: 99900,
      newPrice: 49900,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      now: new Date('2026-03-16'),
    });

    expect(amount).toBeLessThan(0);
  });
});

describe('calculateProration — 경계값', () => {
  it('이미 만료된 구독은 0을 청구한다 (음수 일수로 거꾸로 청구하지 않는다)', () => {
    const amount = calculateProration({
      currentPrice: 10000,
      newPrice: 30000,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      now: new Date('2026-04-15'),
    });

    expect(amount).toBe(0);
  });

  it('시작일과 종료일이 같아도 0으로 나누지 않는다', () => {
    const amount = calculateProration({
      currentPrice: 10000,
      newPrice: 30000,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-01',
      now: new Date('2026-03-01'),
    });

    expect(Number.isFinite(amount)).toBe(true);
  });

  it('같은 가격이면 0원', () => {
    const amount = calculateProration({
      currentPrice: 49900,
      newPrice: 49900,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      now: new Date('2026-03-16'),
    });

    expect(amount).toBe(0);
  });

  it('반올림한다 (소수점 금액을 결제로 보내지 않는다)', () => {
    const amount = calculateProration({
      currentPrice: 0,
      newPrice: 10000,
      periodStart: '2026-03-01',
      periodEnd: '2026-03-08',
      now: new Date('2026-03-04'),
    });

    expect(Number.isInteger(amount)).toBe(true);
  });
});

// ============================================================================
// 갱신 기간
// ============================================================================

describe('addBillingPeriod', () => {
  it('월간은 1개월 뒤', () => {
    const end = addBillingPeriod('2026-03-15T00:00:00Z', 'monthly');
    expect(end.getUTCMonth()).toBe(3); // 4월 (0-based)
    expect(end.getUTCDate()).toBe(15);
  });

  it('연간은 1년 뒤', () => {
    const end = addBillingPeriod('2026-03-15T00:00:00Z', 'yearly');
    expect(end.getUTCFullYear()).toBe(2027);
    expect(end.getUTCMonth()).toBe(2);
  });

  it('원본 날짜를 변경하지 않는다', () => {
    const from = new Date('2026-03-15T00:00:00Z');
    addBillingPeriod(from, 'monthly');
    expect(from.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('연말을 넘어가면 해가 바뀐다', () => {
    const end = addBillingPeriod('2026-12-15T00:00:00Z', 'monthly');
    expect(end.getUTCFullYear()).toBe(2027);
    expect(end.getUTCMonth()).toBe(0);
  });
});

// ============================================================================
// 주기별 가격
// ============================================================================

describe('priceForCycle', () => {
  const plan = { price_monthly: 49900, price_yearly: 449100 };

  it('월간이면 월 가격', () => {
    expect(priceForCycle(plan, 'monthly')).toBe(49900);
  });

  it('연간이면 연 가격 — 월 가격 × 12 가 아니다 (할인이 들어 있다)', () => {
    expect(priceForCycle(plan, 'yearly')).toBe(449100);
    expect(priceForCycle(plan, 'yearly')).toBeLessThan(plan.price_monthly * 12);
  });
});
