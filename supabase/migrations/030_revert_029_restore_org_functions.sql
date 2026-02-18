-- ============================================================================
-- 030: 029 롤백 — 조직 기반 함수 복원
--
-- 029가 일으킨 문제:
-- 1. use_invite_code: 조직 로직 제거 → teacher_student INSERT 시 NOT NULL 위반
-- 2. create_invite: 레거시 1-param 버전 재생성 → 2-param 함수와 혼재
-- 3. get_user_role: 다중 조직 시 역할 충돌 (student+teacher 동시 불가)
-- 4. get_student_practice_stats: 시그니처 DROP 후 재생성 (불필요한 변경)
--
-- 수정 방향:
-- - get_user_role(): 원본 복원 (users.role 반환)
--   → 020/023이 이미 users.role을 동기화하므로 안전
-- - create_invite(int): 029가 만든 레거시 버전 삭제
-- - use_invite_code(text): 023 버전 복원 (owner 분기 + org 처리)
-- - get_student_practice_stats(uuid): 013 버전 복원
-- - admin_list_users(028): 유지 (effective_role은 어드민 화면 전용)
-- ============================================================================

-- ============================================================================
-- 1. get_user_role() — 원본 복원 (users.role 반환)
-- ============================================================================
-- 020/023이 users.role을 동기화하므로:
--   owner 가입 → users.role = 'teacher'
--   teacher 초대 → users.role = 'teacher'
--   student 가입 → users.role = 'student' (기본값)
-- → get_user_role()가 users.role 반환해도 정확

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.users
  WHERE id = p_user_id
    AND deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.get_user_role IS
  '사용자 역할 조회 (users.role 반환, 020/023이 org 역할과 동기화 보장)';

-- ============================================================================
-- 2. create_invite(int) — 029가 만든 레거시 1-param 버전 삭제
-- ============================================================================
-- 020에서 DROP FUNCTION public.create_invite(int) 후 2-param 버전으로 교체했는데
-- 029가 다시 1-param 버전을 만들어 충돌 발생
-- 2-param 버전(020)이 올바른 함수, 1-param 제거

DROP FUNCTION IF EXISTS public.create_invite(int);

-- ============================================================================
-- 3. use_invite_code(text) — 023 버전 복원
-- ============================================================================
-- 029가 레거시로 되돌린 것 복원 (org 처리 + owner 분기 + 알림)

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
    INSERT INTO public.organizations (name, owner_id)
    VALUES (v_invite.organization_name, v_user_id)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
    VALUES (v_org_id, v_user_id, 'owner', v_invite.teacher_id);

    UPDATE public.invites
    SET organization_id = v_org_id
    WHERE id = v_invite.id;

    -- users.role → teacher (하위 호환: owner = teacher superset)
    UPDATE public.users SET role = 'teacher'
    WHERE id = v_user_id AND role = 'student' AND deleted_at IS NULL;

    v_notification_type := 'owner_invite_redeemed';
    v_notification_title := '학원 원장 등록 완료';
    v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id)
      || '님이 ' || v_invite.organization_name || ' 학원 원장으로 등록되었습니다';

  -- ========================================
  -- 3-alt. STUDENT/TEACHER: 기존 로직
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
      UPDATE public.users SET role = 'teacher'
      WHERE id = v_user_id AND role = 'student' AND deleted_at IS NULL;

      v_notification_type := 'teacher_connected';
      v_notification_title := '새 강사 합류';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || ' 강사가 합류했습니다';

    ELSE
      v_notification_type := 'student_connected';
      v_notification_title := '새 멤버 연결';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || '님이 연결되었습니다';
    END IF;
  END IF;

  -- 5. 알림
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

COMMENT ON FUNCTION public.use_invite_code IS
  '초대 코드 사용 (023 복원: owner 분기 + 조직 멤버십 + teacher_student + 알림)';

-- ============================================================================
-- 4. get_student_practice_stats(uuid) — 013 버전 복원
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_practice_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_student_practice_stats(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
  v_result jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  IF v_caller_id = p_student_id THEN
    NULL;
  ELSE
    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = v_caller_id AND deleted_at IS NULL;

    IF v_caller_role != 'teacher' AND v_caller_role != 'admin' THEN
      RETURN jsonb_build_object('error', 'UNAUTHORIZED');
    END IF;

    IF v_caller_role = 'teacher' AND NOT EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id
        AND student_id = p_student_id
        AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'NOT_CONNECTED');
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'total_practices', COUNT(*),
    'total_duration_minutes', COALESCE(SUM(duration) / 60, 0),
    'avg_score', COALESCE(ROUND(AVG(score)::numeric, 1), 0),
    'avg_reproduction_rate', COALESCE(ROUND(AVG(reproduction_rate)::numeric, 1), 0),
    'this_week_practices', COUNT(*) FILTER (WHERE created_at > now() - interval '7 days'),
    'last_practice_at', MAX(created_at)
  ) INTO v_result
  FROM public.practices
  WHERE student_id = p_student_id
    AND deleted_at IS NULL;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_student_practice_stats IS
  '학생 연습 통계 (013 복원: auth.uid() + 연결 관계 검증)';
