-- ============================================================================
-- 063: 기존 조직 트라이얼 구독 백필
-- ============================================================================
-- 목적: 059 마이그레이션 이전에 생성된 조직 중 구독이 없는 조직에
--       Solo 14일 트라이얼 구독을 생성 (059 트리거는 INSERT에만 반응)
-- ============================================================================

DO $$
DECLARE
  v_solo_plan_id uuid;
  v_free_plan_id uuid;
  v_backfill_count int := 0;
BEGIN
  -- Solo 플랜 조회
  SELECT id INTO v_solo_plan_id
  FROM public.subscription_plans
  WHERE plan_key = 'solo' AND is_active = true
  LIMIT 1;

  -- Solo 플랜이 없으면 Free 플랜으로 폴백
  IF v_solo_plan_id IS NULL THEN
    SELECT id INTO v_free_plan_id
    FROM public.subscription_plans
    WHERE plan_key = 'free' AND is_active = true
    LIMIT 1;

    IF v_free_plan_id IS NULL THEN
      RAISE NOTICE '[063] No active plans found, skipping backfill';
      RETURN;
    END IF;

    -- Free 플랜으로 구독 생성
    INSERT INTO public.subscriptions (
      user_id, organization_id, plan_id, status,
      billing_provider, billing_cycle,
      current_period_start, current_period_end
    )
    SELECT
      o.owner_id, o.id, v_free_plan_id, 'active',
      'toss', 'monthly',
      now(), now() + interval '100 years'
    FROM public.organizations o
    WHERE o.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.organization_id = o.id
      )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_backfill_count = ROW_COUNT;
    RAISE NOTICE '[063] Backfilled % organizations with free plan', v_backfill_count;
    RETURN;
  END IF;

  -- Solo 트라이얼 구독 생성 (14일)
  INSERT INTO public.subscriptions (
    user_id, organization_id, plan_id, status,
    billing_provider, billing_cycle,
    trial_ends_at,
    current_period_start, current_period_end
  )
  SELECT
    o.owner_id, o.id, v_solo_plan_id, 'trialing',
    'toss', 'monthly',
    now() + interval '14 days',
    now(), now() + interval '14 days'
  FROM public.organizations o
  WHERE o.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.organization_id = o.id
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_backfill_count = ROW_COUNT;
  RAISE NOTICE '[063] Backfilled % organizations with solo trial', v_backfill_count;
END;
$$;
