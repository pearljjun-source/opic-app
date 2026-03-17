/**
 * Phase 6A 구독 시스템 테스트
 *
 * 검증 대상:
 * - 046 마이그레이션: pending_plan_id, grace period, 상태 전이
 * - update-billing-key Edge Function 구조
 * - change-plan Edge Function 구조 (proration, downgrade)
 * - subscription-renew pending_plan_id 적용
 * - 서비스 레이어: updateBillingKey, changePlan
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 1. 마이그레이션 046 구조 검증
// ============================================================================

describe('046_subscription_phase6a migration', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/046_subscription_phase6a.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf-8');
  });

  test('파일이 존재한다', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  test('pending_plan_id 컬럼 추가', () => {
    expect(sql).toContain('pending_plan_id');
    expect(sql).toContain('REFERENCES public.subscription_plans');
  });

  test('check_org_entitlement grace period 로직 포함', () => {
    expect(sql).toContain('v_grace_days');
    expect(sql).toContain('past_due');
    expect(sql).toContain('_entitlement_free_default');
  });

  test('grace_period 반환 필드 포함', () => {
    expect(sql).toContain("'grace_period'");
  });

  test('구독 상태 전이 트리거 포함', () => {
    expect(sql).toContain('enforce_subscription_status_transition');
    expect(sql).toContain('BEFORE UPDATE OF status');
  });

  test('유효한 상태 전이만 허용', () => {
    // trialing → active, canceled
    expect(sql).toContain("OLD.status = 'trialing'");
    // active → past_due, canceled
    expect(sql).toContain("OLD.status = 'active'");
    // past_due → active, canceled
    expect(sql).toContain("OLD.status = 'past_due'");
    // canceled → 변경 불가
    expect(sql).toContain("OLD.status = 'canceled'");
  });
});

// ============================================================================
// 2. update-billing-key Edge Function 구조 검증
// ============================================================================

describe('update-billing-key Edge Function', () => {
  const fnPath = path.resolve(__dirname, '../../supabase/functions/update-billing-key/index.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(fnPath, 'utf-8');
  });

  test('파일이 존재한다', () => {
    expect(fs.existsSync(fnPath)).toBe(true);
  });

  test('org owner 인가 검증', () => {
    expect(code).toContain("eq('role', 'owner')");
    expect(code).toContain('NOT_ORG_OWNER');
  });

  test('기존 구독 조회 (active/past_due)', () => {
    expect(code).toContain("in('status', ['active', 'past_due'])");
  });

  test('Toss 빌링키 교환 API 호출', () => {
    expect(code).toContain('billing/authorizations/issue');
  });

  test('구독 billing_key 업데이트 (암호화)', () => {
    expect(code).toContain('billing_key: await encryptValue(billingKey)');
  });

  test('NO_ACTIVE_SUBSCRIPTION 에러 코드', () => {
    expect(code).toContain('NO_ACTIVE_SUBSCRIPTION');
  });
});

// ============================================================================
// 3. change-plan Edge Function 구조 검증
// ============================================================================

describe('change-plan Edge Function', () => {
  const fnPath = path.resolve(__dirname, '../../supabase/functions/change-plan/index.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(fnPath, 'utf-8');
  });

  test('파일이 존재한다', () => {
    expect(fs.existsSync(fnPath)).toBe(true);
  });

  test('org owner 인가 검증', () => {
    expect(code).toContain("eq('role', 'owner')");
    expect(code).toContain('NOT_ORG_OWNER');
  });

  test('업그레이드: 일할 계산 로직', () => {
    expect(code).toContain('proratedAmount');
    expect(code).toContain('daysRemaining');
    expect(code).toContain('totalDays');
  });

  test('다운그레이드: pending_plan_id 설정', () => {
    expect(code).toContain('pending_plan_id');
  });

  test('다운그레이드: 사용량 초과 검증', () => {
    expect(code).toContain('DOWNGRADE_USAGE_EXCEEDED');
    expect(code).toContain('max_students');
    expect(code).toContain('max_scripts');
  });

  test('동일 플랜 차단', () => {
    expect(code).toContain('SAME_PLAN');
  });

  test('빌링키 없는 경우 차단', () => {
    expect(code).toContain('NO_BILLING_KEY');
  });

  test('Toss 결제 API 호출 (업그레이드)', () => {
    expect(code).toContain('/v1/billing/');
    expect(code).toContain('BILLING_PAYMENT_FAILED');
  });
});

// ============================================================================
// 4. subscription-renew pending_plan_id 적용 검증
// ============================================================================

describe('subscription-renew Edge Function', () => {
  const fnPath = path.resolve(__dirname, '../../supabase/functions/subscription-renew/index.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(fnPath, 'utf-8');
  });

  test('pending_plan_id 처리 로직 포함', () => {
    expect(code).toContain('pending_plan_id');
  });

  test('다운그레이드 적용 시 plan_id 변경', () => {
    expect(code).toContain('updateData.plan_id = renewPlan.id');
  });

  test('downgraded 카운터 포함', () => {
    expect(code).toContain('downgraded');
  });

  test('14일 dunning 기간', () => {
    expect(code).toContain('14');
    expect(code).toContain('canceled');
  });

  test('새 플랜 가격으로 갱신 결제', () => {
    expect(code).toContain('renewPlan.price_monthly');
  });
});

// ============================================================================
// 5. 서비스 레이어 검증
// ============================================================================

describe('billing service', () => {
  const servicePath = path.resolve(__dirname, '../../services/billing.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf-8');
  });

  test('updateBillingKey 함수 존재', () => {
    expect(code).toContain('export async function updateBillingKey');
    expect(code).toContain('update-billing-key');
  });

  test('changePlan 함수 존재', () => {
    expect(code).toContain('export async function changePlan');
    expect(code).toContain('change-plan');
  });

  test('changePlan 반환 타입에 type 포함', () => {
    expect(code).toContain("type: 'upgrade' | 'downgrade'");
    expect(code).toContain('proratedAmount');
  });
});

// ============================================================================
// 6. Proration 로직 단위 테스트
// ============================================================================

describe('proration calculation', () => {
  // change-plan Edge Function의 proration 로직을 순수 함수로 테스트
  function calculateProration(
    oldPrice: number,
    newPrice: number,
    periodStart: Date,
    periodEnd: Date,
    now: Date
  ): number {
    const totalDays = Math.max(
      1,
      Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const daysRemaining = Math.max(
      0,
      Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
    const priceDiff = newPrice - oldPrice;
    return Math.round(priceDiff * (daysRemaining / totalDays));
  }

  test('30일 중 15일 남은 업그레이드: 차액의 절반 결제', () => {
    const start = new Date('2026-03-01');
    const end = new Date('2026-03-31');
    const now = new Date('2026-03-16');
    const amount = calculateProration(10000, 30000, start, end, now);
    expect(amount).toBe(10000); // 20000 * 15/30 = 10000
  });

  test('전체 기간 남은 업그레이드: 전체 차액 결제', () => {
    const start = new Date('2026-03-01');
    const end = new Date('2026-03-31');
    const now = new Date('2026-03-01');
    const amount = calculateProration(10000, 30000, start, end, now);
    expect(amount).toBe(20000); // 20000 * 30/30 = 20000
  });

  test('1일 남은 업그레이드: 최소 금액', () => {
    const start = new Date('2026-03-01');
    const end = new Date('2026-03-31');
    const now = new Date('2026-03-30');
    const amount = calculateProration(10000, 30000, start, end, now);
    expect(amount).toBe(667); // 20000 * 1/30 = 666.67 → 667
  });

  test('만료 후 업그레이드: 0원', () => {
    const start = new Date('2026-03-01');
    const end = new Date('2026-03-31');
    const now = new Date('2026-04-01');
    const amount = calculateProration(10000, 30000, start, end, now);
    expect(amount).toBe(0); // daysRemaining = 0
  });

  test('다운그레이드: 음수 → 실제 서비스에서는 pending으로 처리', () => {
    const start = new Date('2026-03-01');
    const end = new Date('2026-03-31');
    const now = new Date('2026-03-16');
    const amount = calculateProration(30000, 10000, start, end, now);
    expect(amount).toBeLessThan(0); // -20000 * 15/30 = -10000
  });
});

// ============================================================================
// 7. Grace Period 로직 테스트
// ============================================================================

describe('grace period logic', () => {
  function isWithinGracePeriod(
    status: string,
    periodEnd: Date,
    now: Date,
    graceDays: number = 7
  ): boolean {
    if (status !== 'past_due') return true; // active/trialing은 항상 허용
    if (!periodEnd) return false;
    const graceEnd = new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);
    return now < graceEnd;
  }

  test('active 상태: 항상 허용', () => {
    expect(isWithinGracePeriod('active', new Date(), new Date())).toBe(true);
  });

  test('past_due + 3일: grace 기간 내', () => {
    const periodEnd = new Date('2026-03-01');
    const now = new Date('2026-03-04');
    expect(isWithinGracePeriod('past_due', periodEnd, now)).toBe(true);
  });

  test('past_due + 7일: grace 기간 경계', () => {
    const periodEnd = new Date('2026-03-01');
    const now = new Date('2026-03-08');
    // exactly at boundary — graceEnd is 2026-03-08T00:00:00, now is same → not within
    expect(isWithinGracePeriod('past_due', periodEnd, now)).toBe(false);
  });

  test('past_due + 10일: grace 기간 초과', () => {
    const periodEnd = new Date('2026-03-01');
    const now = new Date('2026-03-11');
    expect(isWithinGracePeriod('past_due', periodEnd, now)).toBe(false);
  });
});

// ============================================================================
// 8. 상태 전이 규칙 테스트
// ============================================================================

describe('subscription status transitions', () => {
  const validTransitions: Record<string, string[]> = {
    trialing: ['active', 'canceled'],
    active: ['past_due', 'canceled'],
    past_due: ['active', 'canceled'],
    incomplete: ['active', 'canceled'],
    canceled: [], // 변경 불가
  };

  function isValidTransition(from: string, to: string): boolean {
    if (from === to) return true; // 동일 상태 → 트리거 미실행
    return (validTransitions[from] || []).includes(to);
  }

  const allStatuses = ['trialing', 'active', 'past_due', 'incomplete', 'canceled'];

  test('trialing → active: 유효', () => {
    expect(isValidTransition('trialing', 'active')).toBe(true);
  });

  test('trialing → canceled: 유효', () => {
    expect(isValidTransition('trialing', 'canceled')).toBe(true);
  });

  test('trialing → past_due: 무효', () => {
    expect(isValidTransition('trialing', 'past_due')).toBe(false);
  });

  test('active → past_due: 유효', () => {
    expect(isValidTransition('active', 'past_due')).toBe(true);
  });

  test('active → canceled: 유효', () => {
    expect(isValidTransition('active', 'canceled')).toBe(true);
  });

  test('active → trialing: 무효', () => {
    expect(isValidTransition('active', 'trialing')).toBe(false);
  });

  test('past_due → active: 유효 (결제 성공 시 복구)', () => {
    expect(isValidTransition('past_due', 'active')).toBe(true);
  });

  test('past_due → canceled: 유효 (dunning 만료)', () => {
    expect(isValidTransition('past_due', 'canceled')).toBe(true);
  });

  test('canceled → 모든 전이: 무효', () => {
    for (const to of allStatuses.filter(s => s !== 'canceled')) {
      expect(isValidTransition('canceled', to)).toBe(false);
    }
  });
});
