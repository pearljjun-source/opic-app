-- 061_onboarding.sql
-- 용도: 온보딩 상태 추적 (원장 첫 로그인 시 가이드)
-- organizations.onboarding_completed_at: 온보딩 완료 시점 (NULL = 미완료)

-- 1. 온보딩 완료 상태 컬럼 추가
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- 기존 조직은 온보딩 완료 처리 (이미 사용 중인 학원)
UPDATE public.organizations
SET onboarding_completed_at = created_at
WHERE onboarding_completed_at IS NULL;

-- 2. 온보딩 상태 확인 RPC
CREATE OR REPLACE FUNCTION public.get_onboarding_status(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_org_role text;
  v_onboarding_done boolean;
  v_has_teachers boolean;
  v_has_classes boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- owner만 온보딩 상태 조회 가능
  SELECT om.role INTO v_org_role
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id
    AND om.user_id = v_user_id
    AND om.deleted_at IS NULL;

  IF v_org_role IS NULL OR v_org_role != 'owner' THEN
    RETURN jsonb_build_object('error', 'NOT_OWNER');
  END IF;

  -- 온보딩 완료 여부
  SELECT o.onboarding_completed_at IS NOT NULL INTO v_onboarding_done
  FROM public.organizations o
  WHERE o.id = p_org_id;

  IF v_onboarding_done THEN
    RETURN jsonb_build_object('completed', true);
  END IF;

  -- 단계별 완료 상태
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members om2
    WHERE om2.organization_id = p_org_id
      AND om2.role = 'teacher'
      AND om2.deleted_at IS NULL
  ) INTO v_has_teachers;

  SELECT EXISTS(
    SELECT 1 FROM public.classes c
    WHERE c.organization_id = p_org_id
      AND c.deleted_at IS NULL
  ) INTO v_has_classes;

  RETURN jsonb_build_object(
    'completed', false,
    'steps', jsonb_build_object(
      'academy_confirmed', true,
      'has_teachers', v_has_teachers,
      'has_classes', v_has_classes
    )
  );
END;
$$;

-- 3. 온보딩 완료 처리 RPC
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_is_owner boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = v_user_id
      AND om.role = 'owner'
      AND om.deleted_at IS NULL
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('error', 'NOT_OWNER');
  END IF;

  UPDATE public.organizations
  SET onboarding_completed_at = now()
  WHERE id = p_org_id
    AND onboarding_completed_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;
