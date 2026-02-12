-- ============================================================================
-- OPIc 학습 앱 - RPC 함수 업데이트
-- ============================================================================
-- 변경 사항:
-- 1. 새 함수: get_teacher_students (학생 목록 + 통계 일괄 반환)
-- 2. 기존 함수 수정: deleted_at 조건 추가
--    - get_user_role
--    - create_invite
--    - use_invite_code
--    - get_student_practice_stats
--
-- 설계 원칙:
-- - 복잡한 데이터 집계는 서버(RPC)에서 처리
-- - 모든 쿼리에 deleted_at IS NULL 조건 적용
-- - 클라이언트는 단일 RPC 호출로 필요한 데이터 획득
-- ============================================================================

-- ============================================================================
-- 1. 새 함수: get_teacher_students
-- ============================================================================
-- 강사의 연결된 학생 목록과 통계를 한 번에 반환
-- 클라이언트에서 N+1 쿼리 대신 단일 RPC 호출로 처리
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_teacher_students()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  role public.user_role,
  created_at timestamptz,
  scripts_count bigint,
  practices_count bigint,
  last_practice_at timestamptz,
  avg_score numeric,
  avg_reproduction_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  v_teacher_id := auth.uid();

  IF v_teacher_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.name,
    u.role,
    u.created_at,
    -- 스크립트 수 (해당 강사가 작성한 것만)
    COALESCE(
      (SELECT COUNT(*)
       FROM public.scripts s
       WHERE s.student_id = u.id
         AND s.teacher_id = v_teacher_id
         AND s.deleted_at IS NULL),
      0
    ) AS scripts_count,
    -- 연습 수
    COALESCE(
      (SELECT COUNT(*)
       FROM public.practices p
       WHERE p.student_id = u.id
         AND p.deleted_at IS NULL),
      0
    ) AS practices_count,
    -- 마지막 연습 시간
    (SELECT MAX(p.created_at)
     FROM public.practices p
     WHERE p.student_id = u.id
       AND p.deleted_at IS NULL) AS last_practice_at,
    -- 평균 점수
    (SELECT ROUND(AVG(p.score)::numeric, 1)
     FROM public.practices p
     WHERE p.student_id = u.id
       AND p.deleted_at IS NULL
       AND p.score IS NOT NULL) AS avg_score,
    -- 평균 재현율
    (SELECT ROUND(AVG(p.reproduction_rate)::numeric, 1)
     FROM public.practices p
     WHERE p.student_id = u.id
       AND p.deleted_at IS NULL
       AND p.reproduction_rate IS NOT NULL) AS avg_reproduction_rate
  FROM public.users u
  INNER JOIN public.teacher_student ts
    ON ts.student_id = u.id
  WHERE ts.teacher_id = v_teacher_id
    AND ts.deleted_at IS NULL
    AND u.deleted_at IS NULL
  ORDER BY u.name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_teacher_students IS
  '강사의 연결된 학생 목록 + 통계 일괄 반환 (N+1 쿼리 방지)';

-- ============================================================================
-- 2. get_user_role 수정: deleted_at 조건 추가
-- ============================================================================

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
  '사용자 역할 조회 (삭제된 사용자는 NULL 반환)';

-- ============================================================================
-- 3. create_invite 수정: deleted_at 조건 추가
-- ============================================================================

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
  v_user_role public.user_role;
  v_code text;
  v_invite_id uuid;
BEGIN
  -- 현재 사용자 확인
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 역할 확인 (삭제된 사용자 제외)
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_user_id
    AND deleted_at IS NULL;

  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF v_user_role != 'teacher' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_TEACHER');
  END IF;

  -- 코드 생성
  v_code := public.generate_invite_code();

  -- 초대 코드 저장
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

COMMENT ON FUNCTION public.create_invite IS
  '초대 코드 생성 (강사용, 삭제된 사용자 제외)';

-- ============================================================================
-- 4. use_invite_code 수정: deleted_at 조건 추가
-- ============================================================================

CREATE OR REPLACE FUNCTION public.use_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_invite record;
BEGIN
  -- 현재 사용자 확인
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 역할 확인 (삭제된 사용자 제외)
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_user_id
    AND deleted_at IS NULL;

  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF v_user_role != 'student' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_STUDENT');
  END IF;

  -- 유효한 초대 코드 찾기 (삭제되지 않은 것만)
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
    WHERE id = v_invite.teacher_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEACHER_NOT_FOUND');
  END IF;

  -- 이미 연결되어 있는지 확인 (삭제되지 않은 연결만)
  IF EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = v_invite.teacher_id
      AND student_id = v_user_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CONNECTED');
  END IF;

  -- 초대 코드 사용 처리
  UPDATE public.invites
  SET status = 'used', used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id;

  -- 강사-학생 연결
  INSERT INTO public.teacher_student (teacher_id, student_id)
  VALUES (v_invite.teacher_id, v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_invite.teacher_id
  );
END;
$$;

COMMENT ON FUNCTION public.use_invite_code IS
  '초대 코드 사용 (학생용, 삭제된 데이터 제외)';

-- ============================================================================
-- 5. get_student_practice_stats 수정: deleted_at 조건 추가
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_practice_stats(p_student_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'total_practices', COUNT(*),
    'total_duration_minutes', COALESCE(SUM(duration) / 60, 0),
    'avg_score', COALESCE(ROUND(AVG(score)::numeric, 1), 0),
    'avg_reproduction_rate', COALESCE(ROUND(AVG(reproduction_rate)::numeric, 1), 0),
    'this_week_practices', COUNT(*) FILTER (WHERE created_at > now() - interval '7 days'),
    'last_practice_at', MAX(created_at)
  )
  FROM public.practices
  WHERE student_id = p_student_id
    AND deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.get_student_practice_stats IS
  '학생 연습 통계 조회 (삭제된 연습 제외)';

-- ============================================================================
-- 6. generate_invite_code 수정: 삭제된 코드도 중복 방지
-- ============================================================================
-- 참고: 삭제된 초대 코드도 중복 체크에 포함 (코드 재사용 방지)
-- 현재 구현이 올바름, 변경 불필요

