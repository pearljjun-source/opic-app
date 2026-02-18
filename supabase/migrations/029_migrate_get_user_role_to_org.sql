-- ============================================================================
-- 029: get_user_role() → organization_members.role 우선 참조
--
-- 근본 원인: get_user_role()이 레거시 users.role만 반환
-- → 14개 RLS 정책이 전부 레거시 역할 기준으로 동작
-- → owner가 teacher 권한 없음, org teacher가 student 취급
--
-- 수정 전략:
-- 1. get_user_role(): org_members.role 우선, users.role 폴백
--    - owner/teacher → 'teacher'::user_role (RLS에서 teacher 권한 부여)
--    - org student → 'student'::user_role
--    - org 미가입 → users.role 폴백
-- 2. create_invite(): owner도 초대 코드 생성 가능
-- 3. use_invite_code(): org student도 사용 가능
-- 4. get_student_practice_stats(): owner/org teacher도 조회 가능
--
-- 영향: 14개 RLS 정책이 자동 업데이트 (get_user_role 통해 참조)
-- ============================================================================

-- ============================================================================
-- 1. get_user_role() — 3계층 통합
-- ============================================================================
-- RLS 정책이 'teacher'/'student' 두 값만 확인하므로
-- owner → 'teacher' 매핑 (owner는 teacher 상위 권한)
-- platform_role은 RLS에서 사용하지 않음 (is_super_admin()으로 별도 체크)

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_role text;
  v_legacy_role public.user_role;
BEGIN
  -- 1. organization_members에서 가장 높은 권한 조회
  SELECT om.role::text INTO v_org_role
  FROM public.organization_members om
  WHERE om.user_id = p_user_id AND om.deleted_at IS NULL
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 1
      WHEN 'teacher' THEN 2
      WHEN 'student' THEN 3
    END
  LIMIT 1;

  -- 2. org 역할 → user_role 매핑
  IF v_org_role IN ('owner', 'teacher') THEN
    RETURN 'teacher'::public.user_role;
  ELSIF v_org_role = 'student' THEN
    RETURN 'student'::public.user_role;
  END IF;

  -- 3. org 미가입 → users.role 폴백
  SELECT u.role INTO v_legacy_role
  FROM public.users u
  WHERE u.id = p_user_id AND u.deleted_at IS NULL;

  RETURN v_legacy_role;
END;
$$;

COMMENT ON FUNCTION public.get_user_role IS
  'effective role 반환: org_members.role 우선 (owner/teacher→teacher), users.role 폴백';

-- ============================================================================
-- 2. create_invite() — owner도 초대 코드 생성 허용
-- ============================================================================
-- 기존: v_user_role != 'teacher' → NOT_TEACHER
-- 수정: get_user_role()로 조회 → owner도 'teacher' 반환 → 통과

CREATE OR REPLACE FUNCTION public.create_invite(
  p_expires_in_days int DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_effective_role public.user_role;
  v_code text;
  v_invite_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- get_user_role()로 effective role 사용 (owner도 'teacher' 반환)
  v_effective_role := public.get_user_role(v_user_id);

  IF v_effective_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF v_effective_role != 'teacher' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_TEACHER');
  END IF;

  v_code := public.generate_invite_code();

  INSERT INTO public.invites (teacher_id, code, expires_at)
  VALUES (v_user_id, v_code, now() + (p_expires_in_days || ' days')::interval)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'code', v_code,
    'expires_at', now() + (p_expires_in_days || ' days')::interval
  );
END;
$$;

-- ============================================================================
-- 3. use_invite_code() — org student도 사용 가능
-- ============================================================================
-- 기존: SELECT role FROM users → 레거시 role만 확인
-- 수정: get_user_role()로 effective role 사용

CREATE OR REPLACE FUNCTION public.use_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_effective_role public.user_role;
  v_user_name text;
  v_invite record;
  v_notification_id uuid;
  v_rows_affected int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- effective role + 이름 조회
  v_effective_role := public.get_user_role(v_user_id);

  SELECT u.name INTO v_user_name
  FROM public.users u
  WHERE u.id = v_user_id AND u.deleted_at IS NULL;

  IF v_effective_role IS NULL OR v_user_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF v_effective_role != 'student' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_STUDENT');
  END IF;

  -- 유효한 초대 코드 찾기
  SELECT * INTO v_invite
  FROM public.invites
  WHERE code = upper(trim(p_code))
    AND status = 'pending'
    AND expires_at > now()
    AND deleted_at IS NULL;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  -- 강사가 삭제되었는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_invite.teacher_id AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEACHER_NOT_FOUND');
  END IF;

  -- 이미 연결되어 있는지 확인
  IF EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = v_invite.teacher_id
      AND student_id = v_user_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CONNECTED');
  END IF;

  -- CAS 패턴: 원자적 상태 변경
  UPDATE public.invites
  SET status = 'used',
      used_by = v_user_id,
      used_at = now(),
      updated_at = now()
  WHERE id = v_invite.id AND status = 'pending';

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

  -- 연결 생성
  INSERT INTO public.teacher_student (teacher_id, student_id)
  VALUES (v_invite.teacher_id, v_user_id)
  ON CONFLICT DO NOTHING;

  -- 알림 생성 (UNIQUE 인덱스로 중복 방지)
  INSERT INTO public.notification_logs (
    type, user_id, title, body, data, resource_id, created_by
  )
  VALUES (
    'new_student',
    v_invite.teacher_id,
    '새 학생 연결',
    v_user_name || ' 학생이 초대 코드로 연결되었습니다.',
    jsonb_build_object('student_id', v_user_id, 'student_name', v_user_name),
    v_user_id::text,
    v_user_id
  )
  ON CONFLICT (type, user_id, resource_id) WHERE deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_invite.teacher_id,
    'notification_id', COALESCE(v_notification_id, null)
  );
END;
$$;

-- ============================================================================
-- 4. get_student_practice_stats() — owner/org teacher도 조회 허용
-- ============================================================================
-- 기존: SELECT role FROM users → 'teacher'/'admin'만 허용
-- 수정: get_user_role()로 effective role 사용 → owner도 'teacher' 반환
-- DROP 필요: 기존 함수 시그니처가 다를 수 있음

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

  -- 본인이면 바로 허용
  IF v_caller_id = p_student_id THEN
    NULL;  -- pass through
  ELSE
    -- effective role로 확인 (owner/org teacher → 'teacher')
    v_caller_role := public.get_user_role(v_caller_id);

    IF v_caller_role != 'teacher' AND v_caller_role != 'admin' THEN
      RETURN jsonb_build_object('error', 'UNAUTHORIZED');
    END IF;

    -- teacher인 경우 연결 관계 확인
    IF v_caller_role = 'teacher' AND NOT EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id
        AND student_id = p_student_id
        AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'NOT_CONNECTED');
    END IF;
  END IF;

  -- 통계 조회
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
