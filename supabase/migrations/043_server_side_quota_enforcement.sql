-- ============================================================================
-- 043: 서버 사이드 쿼터 검증 추가
--
-- 근본 원인: "서버가 클라이언트 입력을 신뢰하는 패턴"
-- use_invite_code에 max_students 쿼터 체크 없음 → RPC 직접 호출로 우회 가능
-- 스크립트 INSERT에 max_scripts 쿼터 체크 없음 → API 직접 호출로 우회 가능
--
-- 해결:
-- 1. _check_org_quota(org_id, feature_key) 내부 헬퍼 (auth.uid() 불필요)
-- 2. use_invite_code에 학생 쿼터 검증 삽입
-- 3. scripts INSERT 트리거로 스크립트 쿼터 검증
-- ============================================================================

-- ============================================================================
-- 1. _check_org_quota — 내부 전용 쿼터 헬퍼
--    auth.uid() 없이 org_id 기반으로 쿼터 체크
--    SECURITY DEFINER 함수 내에서 호출 가능
-- ============================================================================

CREATE OR REPLACE FUNCTION public._check_org_quota(
  p_org_id uuid,
  p_feature_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub record;
  v_plan record;
  v_used int;
  c_free_students constant int := 3;
  c_free_scripts constant int := 5;
  v_limit int;
BEGIN
  -- org_id가 없으면 free 기본값
  IF p_org_id IS NULL THEN
    IF p_feature_key = 'max_students' THEN
      v_limit := c_free_students;
    ELSIF p_feature_key = 'max_scripts' THEN
      v_limit := c_free_scripts;
    ELSE
      RETURN jsonb_build_object('allowed', false, 'error', 'UNKNOWN_FEATURE');
    END IF;

    RETURN jsonb_build_object(
      'allowed', true,  -- org 없으면 쿼터 강제 불가
      'limit', v_limit,
      'plan_key', 'free'
    );
  END IF;

  -- 활성 구독 조회
  SELECT s.id, s.plan_id
  INTO v_sub
  FROM public.subscriptions s
  WHERE s.organization_id = p_org_id
    AND s.status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  -- 구독 없으면 free 기본값
  IF NOT FOUND THEN
    IF p_feature_key = 'max_students' THEN
      SELECT COUNT(*) INTO v_used
      FROM public.organization_members
      WHERE organization_id = p_org_id AND role = 'student' AND deleted_at IS NULL;

      RETURN jsonb_build_object(
        'allowed', v_used < c_free_students,
        'limit', c_free_students,
        'used', v_used,
        'remaining', GREATEST(0, c_free_students - v_used),
        'plan_key', 'free'
      );
    ELSIF p_feature_key = 'max_scripts' THEN
      SELECT COUNT(*) INTO v_used
      FROM public.scripts
      WHERE organization_id = p_org_id AND deleted_at IS NULL;

      RETURN jsonb_build_object(
        'allowed', v_used < c_free_scripts,
        'limit', c_free_scripts,
        'used', v_used,
        'remaining', GREATEST(0, c_free_scripts - v_used),
        'plan_key', 'free'
      );
    ELSE
      RETURN jsonb_build_object('allowed', false, 'error', 'UNKNOWN_FEATURE');
    END IF;
  END IF;

  -- 플랜 조회
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  IF NOT FOUND THEN
    -- 플랜 데이터 없으면 free 기본값으로 폴백
    IF p_feature_key = 'max_students' THEN
      v_limit := c_free_students;
    ELSE
      v_limit := c_free_scripts;
    END IF;

    RETURN jsonb_build_object('allowed', true, 'limit', v_limit, 'plan_key', 'free');
  END IF;

  -- 쿼터 체크
  IF p_feature_key = 'max_students' THEN
    SELECT COUNT(*) INTO v_used
    FROM public.organization_members
    WHERE organization_id = p_org_id AND role = 'student' AND deleted_at IS NULL;

    RETURN jsonb_build_object(
      'allowed', v_used < v_plan.max_students,
      'limit', v_plan.max_students,
      'used', v_used,
      'remaining', GREATEST(0, v_plan.max_students - v_used),
      'plan_key', v_plan.plan_key
    );

  ELSIF p_feature_key = 'max_scripts' THEN
    SELECT COUNT(*) INTO v_used
    FROM public.scripts
    WHERE organization_id = p_org_id AND deleted_at IS NULL;

    RETURN jsonb_build_object(
      'allowed', v_used < v_plan.max_scripts,
      'limit', v_plan.max_scripts,
      'used', v_used,
      'remaining', GREATEST(0, v_plan.max_scripts - v_used),
      'plan_key', v_plan.plan_key
    );

  ELSE
    RETURN jsonb_build_object('allowed', false, 'error', 'UNKNOWN_FEATURE');
  END IF;
END;
$$;

COMMENT ON FUNCTION public._check_org_quota IS
  '내부 전용: org_id 기반 쿼터 체크. SECURITY DEFINER 함수 내에서 호출 가능 (auth.uid() 불필요)';

-- ============================================================================
-- 2. use_invite_code — 학생 초대 시 max_students 쿼터 검증 추가
-- ============================================================================

CREATE OR REPLACE FUNCTION public.use_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_invite record;
  v_org_id uuid;
  v_rows_affected int;
  v_notification_id uuid;
  v_notification_type text;
  v_notification_title text;
  v_notification_body text;
  v_quota jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_invite FROM public.invites
  WHERE code = upper(trim(p_code))
    AND status = 'pending'
    AND expires_at > now()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  v_org_id := v_invite.organization_id;

  IF v_invite.teacher_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_USE_OWN_CODE');
  END IF;

  -- ★ 학생 초대 시 쿼터 검증 (서버 사이드)
  IF v_invite.target_role = 'student' AND v_org_id IS NOT NULL THEN
    v_quota := public._check_org_quota(v_org_id, 'max_students');
    IF NOT (v_quota->>'allowed')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'STUDENT_QUOTA_EXCEEDED',
        'limit', (v_quota->>'limit')::int,
        'used', (v_quota->>'used')::int,
        'plan_key', v_quota->>'plan_key'
      );
    END IF;
  END IF;

  -- CAS
  UPDATE public.invites
  SET status = 'used', used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id AND status = 'pending';
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

  -- ========================================
  -- OWNER: 조직 생성 + owner 멤버십
  -- ========================================
  IF v_invite.target_role = 'owner' THEN
    INSERT INTO public.organizations (name, owner_id)
    VALUES (v_invite.organization_name, v_user_id)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
    VALUES (v_org_id, v_user_id, 'owner', v_invite.teacher_id);

    UPDATE public.invites
    SET organization_id = v_org_id
    WHERE id = v_invite.id;

    v_notification_type := 'owner_invite_redeemed';
    v_notification_title := '학원 원장 등록 완료';
    v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id)
      || '님이 ' || v_invite.organization_name || ' 학원 원장으로 등록되었습니다';

  -- ========================================
  -- STUDENT/TEACHER: 기존 로직
  -- ========================================
  ELSE
    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
      VALUES (v_org_id, v_user_id, v_invite.target_role, v_invite.teacher_id)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_invite.target_role = 'student' THEN
      IF v_org_id IS NOT NULL THEN
        INSERT INTO public.teacher_student (teacher_id, student_id, organization_id)
        VALUES (v_invite.teacher_id, v_user_id, v_org_id)
        ON CONFLICT DO NOTHING;
      ELSE
        INSERT INTO public.teacher_student (teacher_id, student_id, organization_id)
        SELECT v_invite.teacher_id, v_user_id, om.organization_id
        FROM public.organization_members om
        WHERE om.user_id = v_invite.teacher_id AND om.role IN ('owner', 'teacher')
          AND om.deleted_at IS NULL
        LIMIT 1
        ON CONFLICT DO NOTHING;
      END IF;

      v_notification_type := 'student_connected';
      v_notification_title := '새 학생 연결';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || ' 학생이 연결되었습니다';

    ELSIF v_invite.target_role = 'teacher' THEN
      v_notification_type := 'teacher_connected';
      v_notification_title := '새 강사 합류';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || ' 강사가 합류했습니다';

    ELSE
      v_notification_type := 'student_connected';
      v_notification_title := '새 멤버 연결';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || '님이 연결되었습니다';
    END IF;
  END IF;

  -- 알림
  INSERT INTO public.notification_logs (user_id, type, title, body, data, created_by, resource_id)
  VALUES (
    v_invite.teacher_id,
    v_notification_type,
    v_notification_title,
    v_notification_body,
    jsonb_build_object(
      'user_id', v_user_id,
      'invite_id', v_invite.id,
      'target_role', v_invite.target_role::text,
      'organization_id', v_org_id
    ),
    v_user_id,
    v_invite.id
  )
  ON CONFLICT (type, user_id, resource_id) WHERE deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_invite.teacher_id,
    'organization_id', v_org_id,
    'role', v_invite.target_role,
    'notification_log_id', v_notification_id
  );
END;
$$;

-- ============================================================================
-- 3. enforce_script_quota — 스크립트 INSERT 시 쿼터 검증 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_script_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quota jsonb;
BEGIN
  -- organization_id가 없으면 트리거 패스 (레거시 데이터 보호)
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_quota := public._check_org_quota(NEW.organization_id, 'max_scripts');

  IF NOT (v_quota->>'allowed')::boolean THEN
    RAISE EXCEPTION 'SCRIPT_QUOTA_EXCEEDED: limit=%, used=%',
      (v_quota->>'limit')::int,
      (v_quota->>'used')::int
    USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- 기존 트리거 제거 후 재생성 (멱등성)
DROP TRIGGER IF EXISTS trg_enforce_script_quota ON public.scripts;

CREATE TRIGGER trg_enforce_script_quota
  BEFORE INSERT ON public.scripts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_script_quota();

COMMENT ON FUNCTION public.enforce_script_quota IS
  '스크립트 INSERT 시 organization의 max_scripts 쿼터 검증. 초과 시 RAISE EXCEPTION.';
COMMENT ON FUNCTION public._check_org_quota IS
  '내부 전용: org_id 기반 쿼터 체크. SECURITY DEFINER 함수 내에서 호출 가능 (auth.uid() 불필요)';
