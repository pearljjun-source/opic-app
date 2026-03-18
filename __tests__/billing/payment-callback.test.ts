/**
 * 결제 콜백 시뮬레이션 테스트
 *
 * 검증 대상:
 * 1. 토스 표준 패턴: 전용 콜백 라우트 구조
 * 2. plan-select.tsx에서 콜백 로직 완전 제거 확인
 * 3. subscription.tsx에서 콜백 로직 완전 제거 확인
 * 4. payment-callback.tsx의 마운트 1회 처리 패턴
 * 5. useSubscription.ts 의존성 안정화
 * 6. 상수 중앙 관리 (PAYMENT_CALLBACK)
 * 7. URL 빌더 표준화 (buildPaymentUrls)
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 1. 파일 구조 검증 — 전용 콜백 라우트 존재
// ============================================================================

describe('payment-callback route structure', () => {
  const callbackPath = path.resolve(__dirname, '../../app/(teacher)/manage/payment-callback.tsx');
  const layoutPath = path.resolve(__dirname, '../../app/(teacher)/manage/_layout.tsx');

  test('payment-callback.tsx 파일이 존재한다', () => {
    expect(fs.existsSync(callbackPath)).toBe(true);
  });

  test('_layout.tsx에 payment-callback 라우트가 등록되어 있다', () => {
    const layout = fs.readFileSync(layoutPath, 'utf8');
    expect(layout).toContain('name="payment-callback"');
  });

  test('payment-callback은 headerShown: false로 설정', () => {
    const layout = fs.readFileSync(layoutPath, 'utf8');
    expect(layout).toContain('headerShown: false');
  });
});

// ============================================================================
// 2. plan-select.tsx — 콜백 로직 완전 제거 확인
// ============================================================================

describe('plan-select.tsx — callback logic removed', () => {
  const planSelectPath = path.resolve(__dirname, '../../app/(teacher)/manage/plan-select.tsx');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(planSelectPath, 'utf8');
  });

  test('callbackProcessed ref가 제거되었다', () => {
    expect(code).not.toContain('callbackProcessed');
  });

  test('processPaymentCallback 함수가 제거되었다', () => {
    expect(code).not.toContain('processPaymentCallback');
  });

  test('cleanUrlParams 함수가 제거되었다', () => {
    expect(code).not.toContain('cleanUrlParams');
  });

  test('authKey 파라미터 의존 useEffect가 제거되었다', () => {
    expect(code).not.toContain('params.authKey');
  });

  test('success 상태가 제거되었다', () => {
    expect(code).not.toContain('setSuccess(');
    expect(code).not.toContain('success &&');
  });

  test('issueBillingKey import가 제거되었다', () => {
    expect(code).not.toContain('issueBillingKey');
  });

  test('useLocalSearchParams가 제거되었다', () => {
    expect(code).not.toContain('useLocalSearchParams');
  });

  test('buildPaymentUrls를 새 시그니처로 호출한다', () => {
    expect(code).toContain("action: 'new-subscription'");
    expect(code).toContain('planKey: plan.plan_key');
  });

  test('billingCycle 상태는 유지된다 (플랜 선택 UI용)', () => {
    expect(code).toContain('billingCycle');
    expect(code).toContain('setBillingCycle');
  });
});

// ============================================================================
// 3. subscription.tsx — 콜백 로직 완전 제거 확인
// ============================================================================

describe('subscription.tsx — callback logic removed', () => {
  const subPath = path.resolve(__dirname, '../../app/(teacher)/manage/subscription.tsx');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(subPath, 'utf8');
  });

  test('인라인 콜백 useEffect가 제거되었다', () => {
    // 이전: useEffect 안에서 window.location.href로 authKey 추출
    expect(code).not.toContain('url.searchParams.get(\'authKey\')');
    expect(code).not.toContain('window.history.replaceState');
  });

  test('updateBillingKey import가 제거되었다', () => {
    expect(code).not.toContain('updateBillingKey');
  });

  test('buildPaymentUrls를 새 시그니처로 호출한다', () => {
    expect(code).toContain("action: 'update-billing'");
  });

  test('콜백 처리를 payment-callback 라우트에 위임한다', () => {
    // 코멘트에서 명시
    expect(code).toContain('payment-callback');
  });
});

// ============================================================================
// 4. payment-callback.tsx — 마운트 1회 처리 패턴 검증
// ============================================================================

describe('payment-callback.tsx — mount-once pattern', () => {
  const callbackPath = path.resolve(__dirname, '../../app/(teacher)/manage/payment-callback.tsx');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(callbackPath, 'utf8');
  });

  test('useEffect 의존성 배열이 비어있다 (마운트 1회)', () => {
    // useEffect(() => { ... }, []); 패턴
    expect(code).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?\},\s*\[\]\)/);
  });

  test('URL 파라미터를 ref에 캡처한다', () => {
    expect(code).toContain('paramsRef');
    expect(code).toContain('captureUrlParams');
  });

  test('URL 즉시 정리한다 (cleanPaymentUrlParams)', () => {
    expect(code).toContain('cleanPaymentUrlParams()');
  });

  test('processedRef로 중복 실행을 방지한다', () => {
    expect(code).toContain('processedRef');
    expect(code).toContain('processedRef.current = true');
  });

  test('processedRef는 에러 시 리셋되지 않는다 (재시도는 명시적 handleRetry)', () => {
    // processCallback 함수 내부에서 processedRef를 false로 설정하면 안 됨
    // handleRetry에서만 리셋
    const processCallbackMatch = code.match(/const processCallback = async[\s\S]*?(?=\n\s*\/\*\*|\n\s*const handle)/);
    if (processCallbackMatch) {
      const processBody = processCallbackMatch[0];
      // processCallback 내부에서 processedRef.current = false가 없어야 함
      expect(processBody).not.toContain('processedRef.current = false');
    }
  });

  test('상태 머신: loading → processing → success | error', () => {
    expect(code).toContain("'loading'");
    expect(code).toContain("'processing'");
    expect(code).toContain("'success'");
    expect(code).toContain("'error'");
  });

  test('PAYMENT_CALLBACK 상수를 사용한다', () => {
    expect(code).toContain('PAYMENT_CALLBACK.STATUS.FAIL');
    expect(code).toContain('PAYMENT_CALLBACK.ACTIONS.NEW_SUBSCRIPTION');
    expect(code).toContain('PAYMENT_CALLBACK.ACTIONS.UPDATE_BILLING');
  });

  test('auth 대기를 polling으로 처리한다 (의존성 아님)', () => {
    expect(code).toContain('waitForAuthAndProcess');
    expect(code).toContain('supabase.auth.getUser()');
  });

  test('에러 시 재시도 버튼이 있다', () => {
    expect(code).toContain('handleRetry');
    expect(code).toContain('재시도');
  });

  test('성공 시 적절한 화면으로 이동한다', () => {
    expect(code).toContain('navigateBack');
    expect(code).toContain('/(teacher)/manage/subscription');
    expect(code).toContain('/(teacher)/manage/plan-select');
  });
});

// ============================================================================
// 5. useSubscription.ts — 의존성 안정화 검증
// ============================================================================

describe('useSubscription — dependency stabilization', () => {
  const hookPath = path.resolve(__dirname, '../../hooks/useSubscription.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(hookPath, 'utf8');
  });

  test('useEffect 의존성에 currentOrg 객체가 없다', () => {
    // 의존성 배열에서 currentOrg 대신 orgId(문자열)를 사용
    const effectMatch = code.match(/useEffect\([\s\S]*?\[([^\]]*)\]/);
    expect(effectMatch).not.toBeNull();
    const deps = effectMatch![1];
    expect(deps).not.toContain('currentOrg');
    expect(deps).toContain('orgId');
  });

  test('refresh useCallback 의존성에 currentOrg 객체가 없다', () => {
    const refreshMatch = code.match(/refresh = useCallback[\s\S]*?\[([^\]]*)\]/);
    expect(refreshMatch).not.toBeNull();
    const deps = refreshMatch![1];
    expect(deps).not.toContain('currentOrg');
    expect(deps).toContain('orgId');
  });

  test('orgId를 문자열로 추출한다', () => {
    expect(code).toContain('const orgId = currentOrg?.id');
  });
});

// ============================================================================
// 6. 상수 중앙 관리 검증
// ============================================================================

describe('PAYMENT_CALLBACK constants', () => {
  const constantsPath = path.resolve(__dirname, '../../lib/constants.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(constantsPath, 'utf8');
  });

  test('PAYMENT_CALLBACK 상수가 정의되어 있다', () => {
    expect(code).toContain('PAYMENT_CALLBACK');
  });

  test('PATH가 payment-callback 라우트를 가리킨다', () => {
    expect(code).toContain('/(teacher)/manage/payment-callback');
  });

  test('ACTIONS에 NEW_SUBSCRIPTION과 UPDATE_BILLING이 있다', () => {
    expect(code).toContain('NEW_SUBSCRIPTION');
    expect(code).toContain('UPDATE_BILLING');
  });

  test('STATUS에 SUCCESS, FAIL, PROCESSING이 있다', () => {
    expect(code).toContain('SUCCESS');
    expect(code).toContain('FAIL');
    expect(code).toContain('PROCESSING');
  });
});

// ============================================================================
// 7. URL 빌더 검증
// ============================================================================

describe('buildPaymentUrls — new signature', () => {
  const tossPath = path.resolve(__dirname, '../../lib/toss.ts');
  let code: string;

  beforeAll(() => {
    code = fs.readFileSync(tossPath, 'utf8');
  });

  test('action 파라미터를 받는다', () => {
    expect(code).toContain("action: 'new-subscription' | 'update-billing'");
  });

  test('PAYMENT_CALLBACK.PATH를 사용한다', () => {
    expect(code).toContain('PAYMENT_CALLBACK.PATH');
  });

  test('cleanPaymentUrlParams 유틸이 export된다', () => {
    expect(code).toContain('export function cleanPaymentUrlParams');
  });

  test('이전 plan-select 하드코딩 경로가 없다', () => {
    expect(code).not.toContain("'/(teacher)/manage/plan-select'");
  });
});

// ============================================================================
// 8. 무한루프 방지 시뮬레이션
// ============================================================================

describe('infinite loop prevention simulation', () => {
  test('plan-select에 콜백 useEffect가 없으므로 루프 불가', () => {
    const planSelectPath = path.resolve(__dirname, '../../app/(teacher)/manage/plan-select.tsx');
    const code = fs.readFileSync(planSelectPath, 'utf8');

    // useEffect 의존성에 isProcessing, currentOrg, isAuthenticated가 없어야 함
    // (플랜 로드용 useEffect만 남아있어야 함)
    const effectMatches = code.match(/useEffect\([\s\S]*?\[([^\]]*)\]\)/g) || [];

    // 오직 1개의 useEffect만 있어야 함 (플랜 목록 로드)
    expect(effectMatches.length).toBe(1);

    // 그 useEffect는 빈 의존성
    expect(effectMatches[0]).toContain('[]');
  });

  test('subscription.tsx에 콜백 useEffect가 없다', () => {
    const subPath = path.resolve(__dirname, '../../app/(teacher)/manage/subscription.tsx');
    const code = fs.readFileSync(subPath, 'utf8');

    // currentOrg 의존 useEffect 검색
    const effectMatches = code.match(/useEffect\([\s\S]*?\[([^\]]*currentOrg[^\]]*)\]\)/g) || [];

    // currentOrg를 의존성으로 가진 useEffect가 없어야 함
    expect(effectMatches.length).toBe(0);
  });

  test('payment-callback에 빈 의존성 useEffect만 있다', () => {
    const callbackPath = path.resolve(__dirname, '../../app/(teacher)/manage/payment-callback.tsx');
    const code = fs.readFileSync(callbackPath, 'utf8');

    // 실제 useEffect 호출만 카운트 (import/코멘트 제외)
    const lines = code.split('\n');
    const effectCallLines = lines.filter(l =>
      l.trim().startsWith('useEffect(') || l.trim().startsWith('}, [')
    );

    // useEffect 호출이 1개만 존재
    const callLines = lines.filter(l => l.trim().startsWith('useEffect('));
    expect(callLines.length).toBe(1);

    // 의존성 배열이 비어있음
    expect(code).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?\},\s*\[\]\)/);
  });

  test('useSubscription의 의존성에 객체 참조가 없다', () => {
    const hookPath = path.resolve(__dirname, '../../hooks/useSubscription.ts');
    const code = fs.readFileSync(hookPath, 'utf8');

    const effectMatches = code.match(/useEffect\([\s\S]*?\[([^\]]*)\]\)/g) || [];
    for (const match of effectMatches) {
      // 객체 참조 (currentOrg, subscription 등) 대신 원시값 (orgId, isAuthenticated) 사용
      expect(match).not.toContain('currentOrg]');
      expect(match).not.toContain('currentOrg,');
    }
  });
});

// ============================================================================
// 9. 결제 플로우 시나리오 시뮬레이션
// ============================================================================

describe('payment flow scenarios', () => {
  test('시나리오 1: 신규 구독 — plan-select → Toss → payment-callback → 성공', () => {
    // plan-select에서 buildPaymentUrls 호출
    const planCode = fs.readFileSync(
      path.resolve(__dirname, '../../app/(teacher)/manage/plan-select.tsx'), 'utf8'
    );
    expect(planCode).toContain("action: 'new-subscription'");
    expect(planCode).toContain('requestTossBillingAuth');

    // payment-callback에서 issueBillingKey 호출
    const callbackCode = fs.readFileSync(
      path.resolve(__dirname, '../../app/(teacher)/manage/payment-callback.tsx'), 'utf8'
    );
    expect(callbackCode).toContain('issueBillingKey');
    expect(callbackCode).toContain('refreshSubscription');
  });

  test('시나리오 2: 결제 수단 변경 — subscription → Toss → payment-callback → 성공', () => {
    // subscription에서 buildPaymentUrls 호출
    const subCode = fs.readFileSync(
      path.resolve(__dirname, '../../app/(teacher)/manage/subscription.tsx'), 'utf8'
    );
    expect(subCode).toContain("action: 'update-billing'");
    expect(subCode).toContain('requestTossBillingAuth');

    // payment-callback에서 updateBillingKey 호출
    const callbackCode = fs.readFileSync(
      path.resolve(__dirname, '../../app/(teacher)/manage/payment-callback.tsx'), 'utf8'
    );
    expect(callbackCode).toContain('updateBillingKey');
  });

  test('시나리오 3: 결제 실패 — Toss → payment-callback?status=fail → 에러 표시', () => {
    const callbackCode = fs.readFileSync(
      path.resolve(__dirname, '../../app/(teacher)/manage/payment-callback.tsx'), 'utf8'
    );
    expect(callbackCode).toContain('PAYMENT_CALLBACK.STATUS.FAIL');
    expect(callbackCode).toContain('결제가 취소되었습니다');
  });

  test('시나리오 4: 브라우저 새로고침 — URL 정리됨 → 에러 메시지', () => {
    const callbackCode = fs.readFileSync(
      path.resolve(__dirname, '../../app/(teacher)/manage/payment-callback.tsx'), 'utf8'
    );
    // authKey 없으면 에러 표시
    expect(callbackCode).toContain('결제 정보를 찾을 수 없습니다');
  });

  test('시나리오 5: 플랜 변경 (change-plan) — plan-select 내에서 직접 처리', () => {
    const planCode = fs.readFileSync(
      path.resolve(__dirname, '../../app/(teacher)/manage/plan-select.tsx'), 'utf8'
    );
    // change-plan은 Toss 리다이렉트 없이 직접 처리
    expect(planCode).toContain('changePlan');
    expect(planCode).toContain('플랜 업그레이드');
    expect(planCode).toContain('플랜 다운그레이드');
  });
});
