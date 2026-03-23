-- ============================================================================
-- 059: 트라이얼 온보딩 (조직 생성 시 14일 무료 체험 자동 생성)
-- ============================================================================
-- 목적: 새 조직(학원)이 생성되면 자동으로 Solo 플랜 14일 트라이얼 구독 생성
-- - use_invite_code에서 owner 초대 사용 시 조직 생성 → 트라이얼 자동 시작
-- - 트라이얼 기간 중 전체 기능 접근 가능 (check_org_entitlement에서 trialing = active)
-- - 트라이얼 만료 시 자동으로 Free 플랜 전환 (subscription-renew Edge Function)
-- ============================================================================

-- 1. 트라이얼 자동 생성 함수
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_solo_plan_id uuid;
  v_free_plan_id uuid;
  v_owner_id uuid;
  v_trial_days int := 14;
BEGIN
  -- Solo 플랜 조회 (트라이얼 기준 플랜)
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
      -- 플랜이 전혀 없으면 무시 (시드 데이터 미적용 상태)
      RETURN NEW;
    END IF;

    -- Free 플랜으로 즉시 구독 생성 (트라이얼 없이)
    INSERT INTO public.subscriptions (
      user_id, organization_id, plan_id, status,
      billing_provider, billing_cycle,
      current_period_start, current_period_end
    ) VALUES (
      NEW.owner_id, NEW.id, v_free_plan_id, 'active',
      'toss', 'monthly',
      now(), now() + interval '100 years'
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
  END IF;

  -- 조직 owner 확인
  v_owner_id := NEW.owner_id;

  -- 이미 해당 조직에 구독이 있으면 생성하지 않음
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organization_id = NEW.id
    AND status IN ('active', 'trialing', 'past_due')
  ) THEN
    RETURN NEW;
  END IF;

  -- Solo 플랜 14일 트라이얼 구독 생성
  INSERT INTO public.subscriptions (
    user_id, organization_id, plan_id, status,
    billing_provider, billing_cycle,
    trial_ends_at,
    current_period_start, current_period_end
  ) VALUES (
    v_owner_id, NEW.id, v_solo_plan_id, 'trialing',
    'toss', 'monthly',
    now() + (v_trial_days || ' days')::interval,
    now(), now() + (v_trial_days || ' days')::interval
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. organizations INSERT 트리거
DROP TRIGGER IF EXISTS trigger_create_trial_subscription ON public.organizations;
CREATE TRIGGER trigger_create_trial_subscription
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trial_subscription();

-- 3. subscription-renew에서 트라이얼 만료 처리를 위한 헬퍼
-- (실제 만료 로직은 subscription-renew Edge Function에서 처리)
-- 여기서는 check_org_entitlement가 trialing을 올바르게 처리하는지 확인

-- check_org_entitlement 이미 trialing을 active와 동일하게 처리하는지 확인:
-- 기존 쿼리에 .in('status', ['active', 'trialing', 'past_due']) 포함되어 있음 ✅

-- 4. 트라이얼 만료 시 free 플랜으로 다운그레이드하는 함수 (cron 또는 subscription-renew에서 호출)
CREATE OR REPLACE FUNCTION public.expire_trial_subscriptions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_free_plan_id uuid;
  v_expired_count int := 0;
BEGIN
  -- Free 플랜 ID 조회
  SELECT id INTO v_free_plan_id
  FROM public.subscription_plans
  WHERE plan_key = 'free' AND is_active = true
  LIMIT 1;

  IF v_free_plan_id IS NULL THEN
    RETURN 0;
  END IF;

  -- trial_ends_at이 지난 trialing 구독을 free로 다운그레이드
  UPDATE public.subscriptions
  SET
    status = 'active',
    plan_id = v_free_plan_id,
    trial_ends_at = NULL,
    billing_cycle = 'monthly',
    updated_at = now()
  WHERE
    status = 'trialing'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at <= now();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;
