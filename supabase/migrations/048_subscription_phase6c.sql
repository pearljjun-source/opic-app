-- ============================================================================
-- 048: Phase 6C — 연간 결제 + 트라이얼
-- ============================================================================
-- 1. subscriptions: billing_cycle 컬럼 (monthly/yearly)
-- 2. subscriptions: trial_ends_at 컬럼 (트라이얼 종료일)
-- 3. subscription-renew에서 billing_cycle 기반 갱신 기간 결정
-- ============================================================================

-- 1. billing_cycle: 월간/연간 구분
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'billing_cycle'
  ) THEN
    CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'yearly');
  END IF;
END
$$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle public.billing_cycle DEFAULT 'monthly';

-- 2. trial_ends_at: 트라이얼 종료 시점 (NULL이면 트라이얼 아님)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- 3. check_org_entitlement에서 trialing 상태 처리 보강
-- trialing 상태는 trial_ends_at까지 유료 플랜 기능 허용
-- (기존 check_org_entitlement는 trialing을 active와 동일하게 처리하므로 추가 변경 불필요)

-- 4. 연간 결제 할인율 계산 헬퍼 (클라이언트에서도 사용 가능하도록 SQL 함수)
CREATE OR REPLACE FUNCTION public.get_plan_yearly_discount(
  p_plan_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan record;
  v_monthly_annual numeric;
  v_discount_pct numeric;
BEGIN
  SELECT price_monthly, price_yearly
  INTO v_plan
  FROM public.subscription_plans
  WHERE plan_key = p_plan_key AND is_active = true;

  IF NOT FOUND OR v_plan.price_monthly = 0 THEN
    RETURN jsonb_build_object('discount_pct', 0, 'monthly_annual', 0);
  END IF;

  v_monthly_annual := v_plan.price_monthly * 12;
  v_discount_pct := ROUND(
    (1 - v_plan.price_yearly::numeric / v_monthly_annual) * 100, 0
  );

  RETURN jsonb_build_object(
    'discount_pct', v_discount_pct,
    'monthly_annual', v_monthly_annual,
    'yearly_price', v_plan.price_yearly,
    'savings', v_monthly_annual - v_plan.price_yearly
  );
END;
$$;

-- 5. 트라이얼 만료 처리: subscription-renew에서 trialing → active 전환 시 사용
-- (별도 트리거 불필요, subscription-renew Edge Function에서 직접 처리)
