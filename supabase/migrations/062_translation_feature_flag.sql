-- ============================================================================
-- 062: 번역 기능 독립 feature flag
--
-- 문제: translate-script Edge Function이 'ai_feedback' entitlement에 묶여 있어
--       AI 피드백과 번역이 분리 불가. 플랜 설계 유연성 저하.
-- 해결: subscription_plans에 translation_enabled 컬럼 추가 + entitlement 함수 확장
-- ============================================================================

-- 1. subscription_plans에 translation_enabled 컬럼 추가
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS translation_enabled boolean NOT NULL DEFAULT false;

-- 기존 유료 플랜(ai_feedback_enabled = true)에 translation_enabled도 true 설정
UPDATE public.subscription_plans
SET translation_enabled = true
WHERE ai_feedback_enabled = true;

-- 2. check_org_entitlement RPC에 translation feature 추가
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

  ELSIF p_feature_key = 'translation' THEN
    RETURN jsonb_build_object(
      'allowed', v_plan.translation_enabled,
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

-- 3. _entitlement_free_default에 translation 분기 추가
CREATE OR REPLACE FUNCTION public._entitlement_free_default(
  p_feature_key text,
  p_user_id uuid,
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_used int;
  c_free_students constant int := 3;
  c_free_scripts constant int := 5;
BEGIN
  IF p_feature_key = 'ai_feedback' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
    );

  ELSIF p_feature_key = 'tts' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
    );

  ELSIF p_feature_key = 'translation' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
    );

  ELSIF p_feature_key = 'max_students' THEN
    IF p_org_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used
      FROM public.organization_members
      WHERE organization_id = p_org_id
        AND role = 'student'
        AND deleted_at IS NULL;
    ELSE
      v_used := 0;
    END IF;

    RETURN jsonb_build_object(
      'allowed', v_used < c_free_students,
      'limit', c_free_students,
      'used', v_used,
      'remaining', GREATEST(0, c_free_students - v_used),
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
    );

  ELSIF p_feature_key = 'max_scripts' THEN
    IF p_org_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used
      FROM public.scripts
      WHERE organization_id = p_org_id
        AND deleted_at IS NULL;
    ELSE
      v_used := 0;
    END IF;

    RETURN jsonb_build_object(
      'allowed', v_used < c_free_scripts,
      'limit', c_free_scripts,
      'used', v_used,
      'remaining', GREATEST(0, c_free_scripts - v_used),
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
    );

  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'UNKNOWN_FEATURE'
    );
  END IF;
END;
$$;
