-- ============================================================================
-- 026_admin_org_management.sql
-- Super Admin: 학원 수정/삭제, 구독 플랜 변경/취소 + 트리거 수정
--
-- 변경 사항:
-- 1. admin_audit_log CHECK 제약 확장 (org_update, org_delete, subscription_create, subscription_cancel)
-- 2. admin_update_organization RPC (학원 이름 수정)
-- 3. admin_delete_organization RPC (cascade soft-delete)
-- 4. admin_update_subscription RPC (플랜 변경/생성)
-- 5. admin_cancel_subscription RPC (구독 취소)
-- 6. validate_subscription_change 트리거 수정 (org 기반 카운트)
-- ============================================================================

-- ============================================================================
-- 1. admin_audit_log CHECK 제약 확장
-- ============================================================================

ALTER TABLE public.admin_audit_log DROP CONSTRAINT valid_action;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT valid_action CHECK (
  action IN (
    'user_role_change', 'landing_update', 'landing_item_create',
    'landing_item_delete', 'landing_reorder', 'plan_update',
    'subscription_change', 'system_config',
    'owner_invite_create', 'owner_invite_delete',
    'org_update', 'org_delete',
    'subscription_create', 'subscription_cancel'
  )
);

-- ============================================================================
-- 2. admin_update_organization RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_organization(
  p_org_id uuid,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_org record;
  v_new_name text;
  v_prev_hash text;
  v_content text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 학원 조회
  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = p_org_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NOT_FOUND');
  END IF;

  -- name 필드 검증 (유일하게 수정 가능한 필드)
  v_new_name := trim(p_updates->>'name');
  IF v_new_name IS NULL OR char_length(v_new_name) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NAME_REQUIRED');
  END IF;

  IF char_length(v_new_name) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NAME_TOO_LONG');
  END IF;

  -- 변경 없으면 skip
  IF v_org.name = v_new_name THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  -- 업데이트 (SECURITY DEFINER → protect_organization_columns 트리거 bypass)
  UPDATE public.organizations
  SET name = v_new_name, updated_at = now()
  WHERE id = p_org_id;

  -- 감사 로그
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log
  ORDER BY created_at DESC LIMIT 1;

  v_content := 'org_update|' || p_org_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (
    admin_id, action, resource_type, resource_id,
    old_value, new_value, content_hash, previous_hash
  )
  VALUES (
    v_caller_id,
    'org_update',
    'organization',
    p_org_id,
    jsonb_build_object('name', v_org.name),
    jsonb_build_object('name', v_new_name),
    encode(extensions.digest(v_content, 'sha256'), 'hex'),
    v_prev_hash
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_update_organization IS 'Super Admin: 학원 정보 수정 (이름)';

-- ============================================================================
-- 3. admin_delete_organization RPC (cascade soft-delete)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_organization(
  p_org_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_org record;
  v_prev_hash text;
  v_content text;
  v_affected jsonb;
  v_sub_count int;
  v_member_count int;
  v_ts_count int;
  v_invite_count int;
  v_class_count int;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 학원 조회
  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = p_org_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NOT_FOUND');
  END IF;

  -- 1. subscriptions → canceled
  UPDATE public.subscriptions
  SET status = 'canceled', canceled_at = now(), updated_at = now()
  WHERE organization_id = p_org_id AND status IN ('active', 'trialing', 'past_due');
  GET DIAGNOSTICS v_sub_count = ROW_COUNT;

  -- 2. organization_members → soft delete
  UPDATE public.organization_members
  SET deleted_at = now()
  WHERE organization_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_member_count = ROW_COUNT;

  -- 3. teacher_student (org 내) → soft delete
  UPDATE public.teacher_student
  SET deleted_at = now()
  WHERE organization_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_ts_count = ROW_COUNT;

  -- 4. invites (org 내) → soft delete
  UPDATE public.invites
  SET deleted_at = now()
  WHERE organization_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_invite_count = ROW_COUNT;

  -- 5. classes (org 내) → soft delete
  UPDATE public.classes
  SET deleted_at = now()
  WHERE organization_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_class_count = ROW_COUNT;

  -- 6. organization → soft delete
  UPDATE public.organizations
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_org_id;

  -- scripts/practices는 이력 보존 (삭제 안 함)

  v_affected := jsonb_build_object(
    'subscriptions_canceled', v_sub_count,
    'members_removed', v_member_count,
    'teacher_students_removed', v_ts_count,
    'invites_removed', v_invite_count,
    'classes_removed', v_class_count
  );

  -- 감사 로그
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log
  ORDER BY created_at DESC LIMIT 1;

  v_content := 'org_delete|' || p_org_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (
    admin_id, action, resource_type, resource_id,
    old_value, new_value, content_hash, previous_hash
  )
  VALUES (
    v_caller_id,
    'org_delete',
    'organization',
    p_org_id,
    jsonb_build_object('name', v_org.name, 'owner_id', v_org.owner_id),
    jsonb_build_object('reason', COALESCE(p_reason, ''), 'affected', v_affected),
    encode(extensions.digest(v_content, 'sha256'), 'hex'),
    v_prev_hash
  );

  RETURN jsonb_build_object('success', true, 'affected', v_affected);
END;
$$;

COMMENT ON FUNCTION public.admin_delete_organization IS 'Super Admin: 학원 삭제 (cascade soft-delete)';

-- ============================================================================
-- 4. admin_update_subscription RPC (플랜 변경/생성)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  p_org_id uuid,
  p_plan_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_org record;
  v_plan record;
  v_sub record;
  v_owner_id uuid;
  v_sub_id uuid;
  v_prev_hash text;
  v_content text;
  v_action text;
  v_old_plan_key text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 학원 조회
  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = p_org_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NOT_FOUND');
  END IF;

  -- 플랜 조회
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE plan_key = p_plan_key AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PLAN_NOT_FOUND');
  END IF;

  -- 기존 활성 구독 확인
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE organization_id = p_org_id
    AND status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  IF FOUND THEN
    -- 같은 플랜이면 에러
    IF v_sub.plan_id = v_plan.id THEN
      RETURN jsonb_build_object('success', false, 'error', 'SAME_PLAN');
    END IF;

    -- 이전 플랜 키 조회 (감사 로그용)
    SELECT plan_key INTO v_old_plan_key
    FROM public.subscription_plans WHERE id = v_sub.plan_id;

    -- 플랜 변경 (validate_subscription_change 트리거 동작)
    UPDATE public.subscriptions
    SET plan_id = v_plan.id,
        updated_at = now(),
        cancel_at_period_end = false,
        canceled_at = NULL
    WHERE id = v_sub.id;

    v_sub_id := v_sub.id;
    v_action := 'subscription_change';
  ELSE
    -- 새 구독 생성 (owner의 user_id 사용)
    v_owner_id := v_org.owner_id;

    INSERT INTO public.subscriptions (
      user_id, plan_id, status, billing_provider,
      current_period_start, current_period_end,
      organization_id
    )
    VALUES (
      v_owner_id, v_plan.id, 'active', 'toss',
      now(), now() + INTERVAL '30 days',
      p_org_id
    )
    RETURNING id INTO v_sub_id;

    v_old_plan_key := NULL;
    v_action := 'subscription_create';
  END IF;

  -- 감사 로그
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log
  ORDER BY created_at DESC LIMIT 1;

  v_content := v_action || '|' || v_sub_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (
    admin_id, action, resource_type, resource_id,
    old_value, new_value, content_hash, previous_hash
  )
  VALUES (
    v_caller_id,
    v_action,
    'subscription',
    v_sub_id,
    CASE WHEN v_old_plan_key IS NOT NULL
      THEN jsonb_build_object('plan_key', v_old_plan_key)
      ELSE NULL
    END,
    jsonb_build_object('plan_key', p_plan_key, 'organization_id', p_org_id),
    encode(extensions.digest(v_content, 'sha256'), 'hex'),
    v_prev_hash
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'action', v_action,
    'plan_key', p_plan_key
  );
END;
$$;

COMMENT ON FUNCTION public.admin_update_subscription IS 'Super Admin: 학원 구독 플랜 변경/생성';

-- ============================================================================
-- 5. admin_cancel_subscription RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_cancel_subscription(
  p_org_id uuid,
  p_immediate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_sub record;
  v_prev_hash text;
  v_content text;
  v_old_plan_key text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 활성 구독 조회
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE organization_id = p_org_id
    AND status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- 이전 플랜 키 (감사 로그용)
  SELECT plan_key INTO v_old_plan_key
  FROM public.subscription_plans WHERE id = v_sub.plan_id;

  IF p_immediate THEN
    -- 즉시 취소
    UPDATE public.subscriptions
    SET status = 'canceled', canceled_at = now(), updated_at = now()
    WHERE id = v_sub.id;
  ELSE
    -- 기간 만료 시 취소
    UPDATE public.subscriptions
    SET cancel_at_period_end = true, canceled_at = now(), updated_at = now()
    WHERE id = v_sub.id;
  END IF;

  -- 감사 로그
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log
  ORDER BY created_at DESC LIMIT 1;

  v_content := 'subscription_cancel|' || v_sub.id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (
    admin_id, action, resource_type, resource_id,
    old_value, new_value, content_hash, previous_hash
  )
  VALUES (
    v_caller_id,
    'subscription_cancel',
    'subscription',
    v_sub.id,
    jsonb_build_object('plan_key', v_old_plan_key, 'status', v_sub.status),
    jsonb_build_object('immediate', p_immediate, 'organization_id', p_org_id),
    encode(extensions.digest(v_content, 'sha256'), 'hex'),
    v_prev_hash
  );

  RETURN jsonb_build_object(
    'success', true,
    'immediate', p_immediate,
    'cancel_at_period_end', NOT p_immediate
  );
END;
$$;

COMMENT ON FUNCTION public.admin_cancel_subscription IS 'Super Admin: 학원 구독 취소';

-- ============================================================================
-- 6. validate_subscription_change 트리거 수정 (org 기반 카운트)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_plan public.subscription_plans;
  v_new_plan public.subscription_plans;
  v_student_count int;
  v_script_count int;
BEGIN
  -- plan_id가 변경되지 않았으면 pass
  IF OLD.plan_id = NEW.plan_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_old_plan FROM public.subscription_plans WHERE id = OLD.plan_id;
  SELECT * INTO v_new_plan FROM public.subscription_plans WHERE id = NEW.plan_id;

  -- 다운그레이드: 학생 수 한도 확인
  IF v_new_plan.max_students < v_old_plan.max_students THEN
    IF NEW.organization_id IS NOT NULL THEN
      -- org 기반: organization_members에서 student 카운트
      SELECT COUNT(*) INTO v_student_count
      FROM public.organization_members
      WHERE organization_id = NEW.organization_id
        AND role = 'student'
        AND deleted_at IS NULL;
    ELSE
      -- 레거시: teacher_student 기반 카운트
      SELECT COUNT(*) INTO v_student_count
      FROM public.teacher_student
      WHERE teacher_id = NEW.user_id AND deleted_at IS NULL;
    END IF;

    IF v_student_count > v_new_plan.max_students THEN
      RAISE EXCEPTION 'DOWNGRADE_STUDENT_LIMIT';
    END IF;
  END IF;

  -- 다운그레이드: 스크립트 수 한도 확인
  IF v_new_plan.max_scripts < v_old_plan.max_scripts THEN
    IF NEW.organization_id IS NOT NULL THEN
      -- org 기반: scripts에서 organization_id로 카운트
      SELECT COUNT(*) INTO v_script_count
      FROM public.scripts
      WHERE organization_id = NEW.organization_id AND deleted_at IS NULL;
    ELSE
      -- 레거시: teacher_id 기반 카운트
      SELECT COUNT(*) INTO v_script_count
      FROM public.scripts
      WHERE teacher_id = NEW.user_id AND deleted_at IS NULL;
    END IF;

    IF v_script_count > v_new_plan.max_scripts THEN
      RAISE EXCEPTION 'DOWNGRADE_SCRIPT_LIMIT';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_subscription_change IS '구독 다운그레이드 시 한도 검증 (org 기반 + 레거시 호환)';
