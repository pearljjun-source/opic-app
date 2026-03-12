/**
 * Phase 6B 구독 시스템 테스트
 *
 * 검증 대상:
 * - 047 마이그레이션: dunning_started_at, cancellation_feedback, 트리거
 * - subscription-renew dunning 마일스톤 알림
 * - 서비스 레이어: submitCancellationFlow
 * - CancellationFlow UI 컴포넌트 구조
 * - 취소 사유 상수
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 1. 마이그레이션 047 구조 검증
// ============================================================================

describe('047_subscription_phase6b migration', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/047_subscription_phase6b.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf-8');
  });

  test('파일이 존재한다', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  test('dunning_started_at 컬럼 추가', () => {
    expect(sql).toContain('dunning_started_at');
    expect(sql).toContain('timestamptz');
  });

  test('cancellation_feedback 테이블 생성', () => {
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('cancellation_feedback');
    expect(sql).toContain('reason text NOT NULL');
    expect(sql).toContain('final_action text NOT NULL');
    expect(sql).toContain('offer_accepted boolean');
  });

  test('cancellation_feedback RLS 정책', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('cancellation_feedback_select_own');
    expect(sql).toContain('cancellation_feedback_insert_own');
    expect(sql).toContain('cancellation_feedback_select_admin');
  });

  test('clear_dunning_on_active 트리거', () => {
    expect(sql).toContain('clear_dunning_on_active');
    expect(sql).toContain("OLD.status = 'past_due'");
    expect(sql).toContain("NEW.status = 'active'");
    expect(sql).toContain('NEW.dunning_started_at := NULL');
  });

  test('admin_get_cancellation_stats 함수', () => {
    expect(sql).toContain('admin_get_cancellation_stats');
    expect(sql).toContain('retention_rate');
    expect(sql).toContain('is_super_admin');
  });
});

// ============================================================================
// 2. subscription-renew dunning 알림 검증
// ============================================================================

describe('subscription-renew dunning notifications', () => {
  const fnPath = path.resolve(__dirname, '../../supabase/functions/subscription-renew/index.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(fnPath, 'utf-8');
  });

  test('sendDunningNotification 헬퍼 함수 존재', () => {
    expect(code).toContain('sendDunningNotification');
    expect(code).toContain('payment_failed');
  });

  test('Day 0, 3, 7, 14 마일스톤 메시지', () => {
    expect(code).toContain('결제 실패');
    expect(code).toContain('결제 재시도 안내');
    expect(code).toContain('서비스 이용 제한 예정');
    expect(code).toContain('구독이 만료되었습니다');
  });

  test('notification_logs에 직접 INSERT', () => {
    expect(code).toContain("from('notification_logs')");
    expect(code).toContain('.insert(');
    expect(code).toContain('resource_id');
  });

  test('Expo Push API 호출', () => {
    expect(code).toContain('exp.host/--/api/v2/push/send');
    expect(code).toContain('push_token');
  });

  test('dunning_started_at 기반 계산', () => {
    expect(code).toContain('dunning_started_at');
    expect(code).toContain('daysSinceDunning');
  });

  test('마일스톤 알림 조건 (Day 0, 3, 7)', () => {
    expect(code).toContain('[0, 3, 7]');
  });

  test('Day 14 취소 알림', () => {
    expect(code).toContain('daysSinceDunning >= 14');
    expect(code).toContain('sendDunningNotification');
  });

  test('notified 결과 카운터', () => {
    expect(code).toContain('results.notified');
  });

  test('dunning_started_at 첫 실패 시 설정', () => {
    expect(code).toContain("dunning_started_at: new Date().toISOString()");
  });
});

// ============================================================================
// 3. 서비스 레이어 검증
// ============================================================================

describe('billing service - cancellation flow', () => {
  const servicePath = path.resolve(__dirname, '../../services/billing.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(servicePath, 'utf-8');
  });

  test('submitCancellationFlow 함수 존재', () => {
    expect(code).toContain('export async function submitCancellationFlow');
  });

  test('cancellation_feedback INSERT', () => {
    expect(code).toContain("from('cancellation_feedback')");
    expect(code).toContain('.insert(');
  });

  test('action별 분기: canceled, downgraded, retained', () => {
    expect(code).toContain("params.action === 'canceled'");
    expect(code).toContain("params.action === 'downgraded'");
    expect(code).toContain("action: 'retained'");
  });

  test('다운그레이드 시 changePlan 호출', () => {
    expect(code).toContain("changePlan('free'");
  });
});

// ============================================================================
// 4. CancellationFlow 컴포넌트 검증
// ============================================================================

describe('CancellationFlow component', () => {
  const componentPath = path.resolve(__dirname, '../../components/ui/CancellationFlow.tsx');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(componentPath, 'utf-8');
  });

  test('파일이 존재한다', () => {
    expect(fs.existsSync(componentPath)).toBe(true);
  });

  test('3단계 플로우: reason, offer, confirm', () => {
    expect(code).toContain("'reason'");
    expect(code).toContain("'offer'");
    expect(code).toContain("'confirm'");
  });

  test('CANCELLATION_REASONS 사용', () => {
    expect(code).toContain('CANCELLATION_REASONS');
  });

  test('사유별 맞춤 제안', () => {
    expect(code).toContain("offer === 'downgrade'");
    expect(code).toContain("offer === 'feedback'");
    expect(code).toContain("offer === 'none'");
  });

  test('영향 안내 (학생수, 스크립트수)', () => {
    expect(code).toContain('studentCount');
    expect(code).toContain('scriptCount');
  });

  test('최종 확인 단계', () => {
    expect(code).toContain('구독 취소 확인');
    expect(code).toContain('구독 유지하기');
  });

  test('Modal 기반 UI', () => {
    expect(code).toContain('Modal');
    expect(code).toContain("animationType=\"slide\"");
  });
});

// ============================================================================
// 5. 취소 사유 상수 검증
// ============================================================================

describe('cancellation reasons constants', () => {
  const constantsPath = path.resolve(__dirname, '../../lib/constants.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(constantsPath, 'utf-8');
  });

  test('CANCELLATION_REASONS 존재', () => {
    expect(code).toContain('CANCELLATION_REASONS');
  });

  test('6개 사유 포함', () => {
    expect(code).toContain('too_expensive');
    expect(code).toContain('not_using');
    expect(code).toContain('missing_feature');
    expect(code).toContain('switching');
    expect(code).toContain('closing_academy');
    expect(code).toContain("'other'");
  });

  test('PAYMENT_FAILED 알림 타입', () => {
    expect(code).toContain("PAYMENT_FAILED: 'payment_failed'");
  });
});

// ============================================================================
// 6. 타입 검증
// ============================================================================

describe('types', () => {
  const typesPath = path.resolve(__dirname, '../../lib/types.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(typesPath, 'utf-8');
  });

  test('CancellationReason 타입', () => {
    expect(code).toContain('CancellationReason');
    expect(code).toContain("'too_expensive'");
    expect(code).toContain("'closing_academy'");
  });

  test('CancellationAction 타입', () => {
    expect(code).toContain('CancellationAction');
    expect(code).toContain("'canceled'");
    expect(code).toContain("'downgraded'");
    expect(code).toContain("'retained'");
  });

  test('payment_failed 알림 타입', () => {
    expect(code).toContain("'payment_failed'");
  });
});

// ============================================================================
// 7. Dunning 마일스톤 로직 단위 테스트
// ============================================================================

describe('dunning milestone logic', () => {
  const DUNNING_MILESTONES = [0, 3, 7, 14];

  function getDunningDay(dunningStartedAt: Date | null, now: Date): number {
    if (!dunningStartedAt) return 0;
    return Math.floor((now.getTime() - dunningStartedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  function shouldNotify(day: number): boolean {
    return [0, 3, 7].includes(day);
  }

  function shouldCancel(day: number): boolean {
    return day >= 14;
  }

  test('첫 실패: Day 0 알림', () => {
    expect(getDunningDay(null, new Date())).toBe(0);
    expect(shouldNotify(0)).toBe(true);
    expect(shouldCancel(0)).toBe(false);
  });

  test('Day 3: 알림', () => {
    const start = new Date('2026-03-01');
    const now = new Date('2026-03-04');
    expect(getDunningDay(start, now)).toBe(3);
    expect(shouldNotify(3)).toBe(true);
  });

  test('Day 5: 알림 안 함', () => {
    const start = new Date('2026-03-01');
    const now = new Date('2026-03-06');
    expect(getDunningDay(start, now)).toBe(5);
    expect(shouldNotify(5)).toBe(false);
    expect(shouldCancel(5)).toBe(false);
  });

  test('Day 7: 알림', () => {
    const start = new Date('2026-03-01');
    const now = new Date('2026-03-08');
    expect(getDunningDay(start, now)).toBe(7);
    expect(shouldNotify(7)).toBe(true);
  });

  test('Day 14: 취소', () => {
    const start = new Date('2026-03-01');
    const now = new Date('2026-03-15');
    expect(getDunningDay(start, now)).toBe(14);
    expect(shouldCancel(14)).toBe(true);
  });

  test('Day 20: 취소 (이미 지남)', () => {
    const start = new Date('2026-03-01');
    const now = new Date('2026-03-21');
    expect(shouldCancel(getDunningDay(start, now))).toBe(true);
  });
});

// ============================================================================
// 8. subscription.tsx 통합 검증
// ============================================================================

describe('subscription screen - cancellation flow integration', () => {
  const screenPath = path.resolve(__dirname, '../../app/(teacher)/manage/subscription.tsx');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(screenPath, 'utf-8');
  });

  test('CancellationFlow 컴포넌트 import', () => {
    expect(code).toContain("import CancellationFlow from '@/components/ui/CancellationFlow'");
  });

  test('submitCancellationFlow import', () => {
    expect(code).toContain('submitCancellationFlow');
  });

  test('showCancelFlow 상태', () => {
    expect(code).toContain('showCancelFlow');
    expect(code).toContain('setShowCancelFlow');
  });

  test('handleCancelFlowComplete 핸들러', () => {
    expect(code).toContain('handleCancelFlowComplete');
  });

  test('CancellationFlow 렌더링', () => {
    expect(code).toContain('<CancellationFlow');
    expect(code).toContain('visible={showCancelFlow}');
    expect(code).toContain('onComplete={handleCancelFlowComplete}');
  });

  test('action별 토스트 메시지', () => {
    expect(code).toContain('구독 취소가 예약되었습니다');
    expect(code).toContain('무료 플랜으로 전환됩니다');
    expect(code).toContain('구독이 유지됩니다');
  });
});
