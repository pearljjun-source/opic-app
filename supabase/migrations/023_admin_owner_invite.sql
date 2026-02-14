-- ============================================================================
-- 023_admin_owner_invite.sql
-- Super Admin → 학원 원장 초대 기능
--
-- 변경 사항:
-- 1. invites 테이블에 organization_name 컬럼 추가 + CHECK 제약
-- 2. admin_audit_log CHECK 제약 확장
-- 3. admin_create_owner_invite RPC (신규)
-- 4. admin_list_owner_invites RPC (신규)
-- 5. admin_delete_owner_invite RPC (신규)
-- 6. admin_list_organizations RPC (신규)
-- 7. use_invite_code 수정 — owner 분기 추가
-- ============================================================================

-- ============================================================================
-- 1. invites 테이블 확장
-- ============================================================================

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS organization_name text;

-- owner 초대는 반드시 학원명 포함 (DB 레벨 제약)
ALTER TABLE public.invites
  ADD CONSTRAINT chk_owner_invite_org_name
  CHECK (target_role != 'owner' OR organization_name IS NOT NULL);

-- ============================================================================
-- 2. admin_audit_log CHECK 제약 확장
-- ============================================================================

ALTER TABLE public.admin_audit_log DROP CONSTRAINT valid_action;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT valid_action CHECK (
  action IN (
    'user_role_change', 'landing_update', 'landing_item_create',
    'landing_item_delete', 'landing_reorder', 'plan_update',
    'subscription_change', 'system_config',
    'owner_invite_create', 'owner_invite_delete'
  )
);

ALTER TABLE public.admin_audit_log DROP CONSTRAINT valid_resource_type;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT valid_resource_type CHECK (
  resource_type IN (
    'user', 'landing_section', 'landing_item',
    'subscription', 'plan', 'system',
    'invite', 'organization'
  )
);

-- ============================================================================
-- 3. admin_create_owner_invite RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_create_owner_invite(
  p_org_name text,
  p_expires_in_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_trimmed_name text;
  v_code text;
  v_invite_id uuid;
  v_prev_hash text;
  v_content text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- super_admin 검증
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 학원명 검증
  v_trimmed_name := trim(p_org_name);
  IF v_trimmed_name IS NULL OR char_length(v_trimmed_name) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NAME_REQUIRED');
  END IF;

  IF char_length(v_trimmed_name) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NAME_TOO_LONG');
  END IF;

  -- 만료일 검증
  IF p_expires_in_days < 1 OR p_expires_in_days > 90 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_EXPIRES_DAYS');
  END IF;

  -- 동일 이름 pending owner 초대 중복 체크
  IF EXISTS (
    SELECT 1 FROM public.invites
    WHERE target_role = 'owner'
      AND organization_name = v_trimmed_name
      AND status = 'pending'
      AND expires_at > now()
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_ORG_NAME_INVITE');
  END IF;

  -- 초대 코드 생성
  v_code := public.generate_invite_code();

  -- invites INSERT (organization_id = NULL — 사용 시 생성)
  INSERT INTO public.invites (
    teacher_id, code, status, expires_at,
    organization_id, target_role, organization_name
  )
  VALUES (
    v_caller_id,
    v_code,
    'pending',
    now() + (p_expires_in_days || ' days')::interval,
    NULL,
    'owner',
    v_trimmed_name
  )
  RETURNING id INTO v_invite_id;

  -- 감사 로그 (SHA256 해시 체인)
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log
  ORDER BY created_at DESC LIMIT 1;

  v_content := 'owner_invite_create|' || v_invite_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (
    admin_id, action, resource_type, resource_id,
    new_value, content_hash, previous_hash
  )
  VALUES (
    v_caller_id,
    'owner_invite_create',
    'invite',
    v_invite_id,
    jsonb_build_object(
      'organization_name', v_trimmed_name,
      'expires_in_days', p_expires_in_days,
      'code', v_code
    ),
    encode(extensions.digest(v_content, 'sha256'), 'hex'),
    v_prev_hash
  );

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'code', v_code,
    'organization_name', v_trimmed_name,
    'expires_at', (now() + (p_expires_in_days || ' days')::interval)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_create_owner_invite IS 'Super Admin: 학원 원장 초대 코드 생성';

-- ============================================================================
-- 4. admin_list_owner_invites RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_owner_invites()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_invites jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_invites
  FROM (
    SELECT jsonb_build_object(
      'id', i.id,
      'code', i.code,
      'status', CASE
        WHEN i.status = 'pending' AND i.expires_at <= now() THEN 'expired'
        ELSE i.status::text
      END,
      'organization_name', i.organization_name,
      'expires_at', i.expires_at,
      'created_at', i.created_at,
      'used_by', i.used_by,
      'used_at', i.used_at,
      'used_by_name', (SELECT u.name FROM public.users u WHERE u.id = i.used_by),
      'used_by_email', (SELECT u.email FROM public.users u WHERE u.id = i.used_by),
      'organization_id', i.organization_id
    ) AS row_data
    FROM public.invites i
    WHERE i.target_role = 'owner'
      AND i.deleted_at IS NULL
  ) sub;

  RETURN jsonb_build_object('success', true, 'invites', v_invites);
END;
$$;

COMMENT ON FUNCTION public.admin_list_owner_invites IS 'Super Admin: 학원 원장 초대 목록 조회';

-- ============================================================================
-- 5. admin_delete_owner_invite RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_owner_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_invite record;
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

  -- 초대 조회 (owner 초대만)
  SELECT * INTO v_invite
  FROM public.invites
  WHERE id = p_invite_id AND target_role = 'owner' AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_NOT_FOUND');
  END IF;

  IF v_invite.status = 'used' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_ALREADY_USED');
  END IF;

  -- soft delete
  UPDATE public.invites
  SET deleted_at = now()
  WHERE id = p_invite_id AND deleted_at IS NULL;

  -- 감사 로그
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log
  ORDER BY created_at DESC LIMIT 1;

  v_content := 'owner_invite_delete|' || p_invite_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (
    admin_id, action, resource_type, resource_id,
    old_value, content_hash, previous_hash
  )
  VALUES (
    v_caller_id,
    'owner_invite_delete',
    'invite',
    p_invite_id,
    jsonb_build_object('organization_name', v_invite.organization_name),
    encode(extensions.digest(v_content, 'sha256'), 'hex'),
    v_prev_hash
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_delete_owner_invite IS 'Super Admin: 학원 원장 초대 삭제 (pending만)';

-- ============================================================================
-- 6. admin_list_organizations RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_organizations()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_orgs jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_orgs
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'created_at', o.created_at,
      'owner_name', (SELECT u.name FROM public.users u WHERE u.id = o.owner_id),
      'owner_email', (SELECT u.email FROM public.users u WHERE u.id = o.owner_id),
      'member_count', (
        SELECT COUNT(*) FROM public.organization_members om
        WHERE om.organization_id = o.id AND om.deleted_at IS NULL
      ),
      'teacher_count', (
        SELECT COUNT(*) FROM public.organization_members om
        WHERE om.organization_id = o.id AND om.role IN ('owner', 'teacher') AND om.deleted_at IS NULL
      ),
      'student_count', (
        SELECT COUNT(*) FROM public.organization_members om
        WHERE om.organization_id = o.id AND om.role = 'student' AND om.deleted_at IS NULL
      )
    ) AS row_data
    FROM public.organizations o
    WHERE o.deleted_at IS NULL
  ) sub;

  RETURN jsonb_build_object('success', true, 'organizations', v_orgs);
END;
$$;

COMMENT ON FUNCTION public.admin_list_organizations IS 'Super Admin: 전체 학원 목록 + 통계';

-- ============================================================================
-- 7. use_invite_code 수정 — owner 분기 추가
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 1. 코드 조회
  SELECT * INTO v_invite FROM public.invites
  WHERE code = upper(trim(p_code))
    AND status = 'pending'
    AND expires_at > now()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  v_org_id := v_invite.organization_id;

  -- 자기 자신의 코드는 사용 불가
  IF v_invite.teacher_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_USE_OWN_CODE');
  END IF;

  -- 2. CAS: 코드 사용 처리
  UPDATE public.invites
  SET status = 'used', used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id AND status = 'pending';
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

  -- ========================================
  -- 3. OWNER: 조직 생성 + owner 멤버십
  -- ========================================
  IF v_invite.target_role = 'owner' THEN
    -- 조직 생성 (name은 invite.organization_name, owner는 사용자)
    INSERT INTO public.organizations (name, owner_id)
    VALUES (v_invite.organization_name, v_user_id)
    RETURNING id INTO v_org_id;

    -- owner 멤버십
    INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
    VALUES (v_org_id, v_user_id, 'owner', v_invite.teacher_id);

    -- invite에 생성된 org_id 기록 (교차 참조)
    UPDATE public.invites
    SET organization_id = v_org_id
    WHERE id = v_invite.id;

    -- users.role → teacher (하위 호환: owner = teacher superset)
    UPDATE public.users SET role = 'teacher'
    WHERE id = v_user_id AND role = 'student' AND deleted_at IS NULL;

    -- 알림 정보 설정
    v_notification_type := 'owner_invite_redeemed';
    v_notification_title := '학원 원장 등록 완료';
    v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id)
      || '님이 ' || v_invite.organization_name || ' 학원 원장으로 등록되었습니다';

  -- ========================================
  -- 3-alt. STUDENT/TEACHER: 기존 로직
  -- ========================================
  ELSE
    -- 조직 멤버로 추가
    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
      VALUES (v_org_id, v_user_id, v_invite.target_role, v_invite.teacher_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- student인 경우: teacher_student 연결
    IF v_invite.target_role = 'student' THEN
      IF v_org_id IS NOT NULL THEN
        INSERT INTO public.teacher_student (teacher_id, student_id, organization_id)
        VALUES (v_invite.teacher_id, v_user_id, v_org_id)
        ON CONFLICT DO NOTHING;
      ELSE
        -- 하위 호환: org_id 없는 기존 초대
        INSERT INTO public.teacher_student (teacher_id, student_id, organization_id)
        SELECT v_invite.teacher_id, v_user_id, om.organization_id
        FROM public.organization_members om
        WHERE om.user_id = v_invite.teacher_id AND om.role IN ('owner', 'teacher')
          AND om.deleted_at IS NULL
        LIMIT 1
        ON CONFLICT DO NOTHING;
      END IF;

      -- 알림 정보 설정
      v_notification_type := 'student_connected';
      v_notification_title := '새 학생 연결';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || ' 학생이 연결되었습니다';

    ELSIF v_invite.target_role = 'teacher' THEN
      -- teacher로 초대된 경우: users.role 업데이트 (하위 호환)
      UPDATE public.users SET role = 'teacher'
      WHERE id = v_user_id AND role = 'student' AND deleted_at IS NULL;

      -- 알림 정보 설정
      v_notification_type := 'teacher_connected';
      v_notification_title := '새 강사 합류';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || ' 강사가 합류했습니다';

    ELSE
      -- 기본 알림
      v_notification_type := 'student_connected';
      v_notification_title := '새 멤버 연결';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || '님이 연결되었습니다';
    END IF;
  END IF;

  -- 5. 알림: invite creator에게 통지
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

COMMENT ON FUNCTION public.use_invite_code IS '초대 코드 사용 (조직 멤버십 + teacher_student 연결 + owner 조직 생성 + 알림)';
