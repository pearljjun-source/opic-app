// ============================================================================
// 결제 금액·기간 계산
//
// ⚠️ 이 파일에는 import 를 넣지 않는다.
//    Edge Function(Deno)과 Jest(Node) 양쪽에서 같은 코드를 불러 쓰기 위해서다.
//    Deno 전용 URL import 가 하나라도 들어가면 테스트에서 못 읽는다.
//
// 왜 따로 뒀나:
//   일할 계산과 갱신 기간 계산이 Edge Function 안에 인라인으로 있었고, 테스트는
//   같은 수식을 테스트 파일 안에 다시 구현해 그 복사본을 검증하고 있었다.
//   Edge Function 의 수식을 바꿔도 테스트는 그대로 통과한다 — 돈을 다루는 계산에서
//   가장 위험한 형태다. 한 곳으로 모아 양쪽이 같은 것을 보게 한다.
// ============================================================================

/**
 * 플랜 변경 시 일할 계산.
 *
 * 남은 기간 비율만큼 차액을 청구한다. 업그레이드면 양수(추가 결제),
 * 다운그레이드면 음수(다음 갱신에 반영, 즉시 환불하지 않는다).
 *
 * ⚠️ totalDays 최소 1 — 같은 날 시작·종료인 구독에서 0으로 나누는 것을 막는다.
 * ⚠️ daysRemaining 최소 0 — 이미 만료된 구독에서 음수가 되어 차액을 거꾸로
 *    청구하는 것을 막는다.
 */
export function calculateProration(params: {
  currentPrice: number;
  newPrice: number;
  periodStart: Date | string;
  periodEnd: Date | string;
  now?: Date;
}): number {
  const DAY_MS = 1000 * 60 * 60 * 24;
  const periodStart = new Date(params.periodStart);
  const periodEnd = new Date(params.periodEnd);
  const now = params.now ?? new Date();

  const totalDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / DAY_MS));
  const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / DAY_MS));

  const priceDiff = params.newPrice - params.currentPrice;
  return Math.round(priceDiff * (daysRemaining / totalDays));
}

/** 구독 주기 */
export type BillingCycle = 'monthly' | 'yearly';

/**
 * 다음 결제 기간의 종료일.
 *
 * ⚠️ setMonth/setFullYear 는 말일을 자동으로 당긴다. 1월 31일 + 1개월은
 *    2월 31일이 아니라 3월 3일이 된다(자바스크립트 기본 동작). 결제일이 밀리는
 *    문제라 알고 쓰는 것이 낫다 — 현재 구현이 그대로이므로 동작을 바꾸지 않는다.
 */
export function addBillingPeriod(from: Date | string, cycle: BillingCycle): Date {
  const end = new Date(from);
  if (cycle === 'yearly') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

/**
 * 다음 청구 기간을 정한다. **밀린 기간은 건너뛴다.**
 *
 * 갱신은 원래 이렇게만 했다.
 *
 *   const newStart = new Date(sub.current_period_end);
 *   const newEnd = addBillingPeriod(newStart, cycle);
 *
 * 한 주기만 전진하므로, 종료일이 오래 지난 구독은 전진 후에도 여전히 과거다.
 * 그러면 다음 실행에서 또 걸리고, 매시간 도는 cron 이라면 **밀린 개월 수만큼
 * 몇 시간 안에 연속으로 청구된다.**
 *
 * 실제로 이 프로젝트는 예약 작업이 설치되지 않아 구독 하나가 5개월 밀려 있었다
 * (2026-09-08 확인). 그 상태로 cron 을 켰다면 5회가 연달아 청구됐을 것이다.
 *
 * 밀린 기간을 청구하지 않는 것이 맞는 이유는, 결제가 정상적으로 실패한 경우는
 * dunning 이 past_due 로 옮기고 14일 뒤 취소하기 때문이다. `active` 인 채로 여러
 * 달이 밀리는 것은 **우리 쪽 실행이 멈춘 경우뿐**이고, 그 대가를 고객이 낼 이유는
 * 없다. 서비스도 그동안 계속 쓸 수 있었다.
 *
 * 밀리지 않은 정상 갱신에서는 한 주기만 전진하므로 기존 동작과 같다.
 *
 * @param previousEnd 지금 기간의 종료일
 * @param now         기준 시각 (테스트에서 주입한다)
 * @returns `skipped` 는 건너뛴 주기 수 — 0 이면 정상 갱신이다
 */
export function nextBillingPeriod(
  previousEnd: Date | string,
  cycle: BillingCycle,
  now: Date = new Date(),
): { start: Date; end: Date; skipped: number } {
  let start = new Date(previousEnd);
  let end = addBillingPeriod(start, cycle);
  let skipped = 0;

  // 데이터가 망가져 있어도 멈추도록 상한을 둔다. 월간 120회면 10년이다.
  const MAX_SKIP = 120;
  while (end.getTime() <= now.getTime() && skipped < MAX_SKIP) {
    start = end;
    end = addBillingPeriod(start, cycle);
    skipped++;
  }

  return { start, end, skipped };
}

/** 주기에 맞는 가격을 고른다 */
export function priceForCycle(
  plan: { price_monthly: number; price_yearly: number },
  cycle: BillingCycle,
): number {
  return cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
}
