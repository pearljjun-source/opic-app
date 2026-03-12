-- ============================================================================
-- 046_subscription_phase6a.sql
-- Phase 6A: 구독 시스템 고도화
--
-- 1. pending_plan_id 컬럼 (다운그레이드 예약)
-- 2. check_org_entitlement에 past_due grace period (7일 유예)
-- 3. 구독 상태 전이 트리거 (유효한 전이만 허용)
-- ============================================================================

-- ============================================================================
-- 1. pending_plan_id — 다운그레이드 다음 갱신 시 적용
-- ============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES public.subscription_plans(id);

COMMENT ON COLUMN public.subscriptions.pending_plan_id
  IS '다운그레이드 예약: 다음 갱신 시 이 플랜으로 전환. NULL이면 현재 플랜 유지.';

-- ============================================================================
-- 2. check_org_entitlement 업데이트 — past_due grace period
--
-- 기존 문제: past_due 구독을 SELECT하지만, feature 체크 시 active/trialing만
-- 허용하는 것이 아니라 past_due도 포함됨 (이미 IN 조건에 있음).
-- 그러나 past_due가 7일 이상이면 차단해야 함.
--
-- 해결: past_due 상태에서 current_period_end + 7일 이내면 기능 허용,
-- 초과하면 free 기본값으로 폴백
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_org_entitlement(p_feature_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_sub record;
  v_plan record;
  v_used int;
  v_grace_days constant int := 7;
  c_free_students constant int := 3;
  c_free_scripts constant int := 5;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 1. 사용자의 가장 높은 권한 org 조회
  SELECT om.organization_id INTO v_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id AND om.deleted_at IS NULL
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 1
      WHEN 'teacher' THEN 2
      WHEN 'student' THEN 3
    END
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, NULL);
  END IF;

  -- 2. org의 활성 구독 조회
  SELECT s.id, s.status, s.plan_id, s.current_period_end
  INTO v_sub
  FROM public.subscriptions s
  WHERE s.organization_id = v_org_id
    AND s.status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, v_org_id);
  END IF;

  -- past_due grace period 체크: 만료 후 7일 초과 시 free 폴백
  IF v_sub.status = 'past_due'
     AND v_sub.current_period_end IS NOT NULL
     AND v_sub.current_period_end + (v_grace_days || ' days')::interval < now()
  THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, v_org_id);
  END IF;

  -- 3. 플랜 조회
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  IF NOT FOUND THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, v_org_id);
  END IF;

  -- 4. feature별 entitlement 체크
  IF p_feature_key = 'ai_feedback' THEN
    RETURN jsonb_build_object(
      'allowed', v_plan.ai_feedback_enabled,
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id,
      'grace_period', v_sub.status = 'past_due'
    );

  ELSIF p_feature_key = 'tts' THEN
    RETURN jsonb_build_object(
      'allowed', v_plan.tts_enabled,
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id,
      'grace_period', v_sub.status = 'past_due'
    );

  ELSIF p_feature_key = 'max_students' THEN
    SELECT COUNT(*) INTO v_used
    FROM public.organization_members
    WHERE organization_id = v_org_id
      AND role = 'student'
      AND deleted_at IS NULL;

    RETURN jsonb_build_object(
      'allowed', v_used < v_plan.max_students,
      'limit', v_plan.max_students,
      'used', v_used,
      'remaining', GREATEST(0, v_plan.max_students - v_used),
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id,
      'grace_period', v_sub.status = 'past_due'
    );

  ELSIF p_feature_key = 'max_scripts' THEN
    SELECT COUNT(*) INTO v_used
    FROM public.scripts
    WHERE organization_id = v_org_id
      AND deleted_at IS NULL;

    RETURN jsonb_build_object(
      'allowed', v_used < v_plan.max_scripts,
      'limit', v_plan.max_scripts,
      'used', v_used,
      'remaining', GREATEST(0, v_plan.max_scripts - v_used),
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id,
      'grace_period', v_sub.status = 'past_due'
    );

  ELSE
    RETURN jsonb_build_object('error', 'UNKNOWN_FEATURE', 'feature_key', p_feature_key);
  END IF;
END;
$$;

-- ============================================================================
-- 3. 구독 상태 전이 트리거
--
-- 유효한 전이:
--   trialing  → active, canceled
--   active    → past_due, canceled
--   past_due  → active, canceled
--   canceled  → (변경 불가)
--   incomplete → active, canceled
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_subscription_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- status 변경이 아니면 통과
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- canceled에서는 변경 불가
  IF OLD.status = 'canceled' THEN
    RAISE EXCEPTION 'Cannot change status from canceled'
      USING ERRCODE = 'P0001';
  END IF;

  -- 허용된 전이 검증
  IF NOT (
    (OLD.status = 'trialing'   AND NEW.status IN ('active', 'canceled'))
    OR (OLD.status = 'active'     AND NEW.status IN ('past_due', 'canceled'))
    OR (OLD.status = 'past_due'   AND NEW.status IN ('active', 'canceled'))
    OR (OLD.status = 'incomplete' AND NEW.status IN ('active', 'canceled'))
  ) THEN
    RAISE EXCEPTION 'Invalid subscription status transition: % → %', OLD.status, NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS trg_subscription_status_transition ON public.subscriptions;
CREATE TRIGGER trg_subscription_status_transition
  BEFORE UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_subscription_status_transition();
