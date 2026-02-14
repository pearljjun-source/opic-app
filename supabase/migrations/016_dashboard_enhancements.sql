-- ============================================================================
-- 016: 대시보드 개선 - DB 변경 사항
--
-- 변경 내용:
-- 1. ALTER TABLE: teacher_student에 target_opic_grade, notes 컬럼 추가
-- 2. INDEX: 스트릭 쿼리 성능 최적화 인덱스
-- 3. MODIFY RPC: get_teacher_students (this_week_practices, pending_feedback_count 추가)
-- 4. MODIFY RPC: get_student_practice_stats (prev_avg_score, target_opic_grade 추가)
-- 5. MODIFY RPC: get_student_detail (notes, target_opic_grade 추가)
-- 6. NEW RPC: get_practice_streak (연습 스트릭 계산)
-- 7. NEW RPC: update_student_notes (메모/목표등급 저장)
--
-- 보안 원칙:
-- - teacher_student에 UPDATE RLS 없음 → 모든 수정은 SECURITY DEFINER RPC로만
-- - target_opic_grade: 화이트리스트 검증 (NL~AL 9개만)
-- - notes: 2000자 길이 제한
-- - get_practice_streak: self/connected teacher 인가 (013 패턴)
-- ============================================================================

-- ============================================================================
-- 1. ALTER TABLE: teacher_student
-- ============================================================================
-- target_opic_grade: 강사가 학생별로 설정하는 목표 OPIc 등급
-- notes: 강사가 학생에 대해 남기는 메모
-- UPDATE RLS 정책 없으므로 클라이언트 직접 수정 불가 (RPC 통해서만 수정)
-- ============================================================================

ALTER TABLE public.teacher_student
ADD COLUMN IF NOT EXISTS target_opic_grade text;

ALTER TABLE public.teacher_student
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.teacher_student.target_opic_grade IS
  '강사가 설정한 학생의 목표 OPIc 등급. update_student_notes RPC로만 수정 가능.';

COMMENT ON COLUMN public.teacher_student.notes IS
  '강사가 학생에 대해 남기는 메모 (최대 2000자). update_student_notes RPC로만 수정 가능.';

-- ============================================================================
-- 2. INDEX: 스트릭 쿼리 성능 최적화
-- ============================================================================
-- get_practice_streak에서 student_id + created_at DESC 범위 스캔에 사용
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_practices_student_created
ON public.practices(student_id, created_at DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. MODIFY RPC: get_teacher_students
-- ============================================================================
-- 추가 컬럼:
-- - this_week_practices: 최근 7일 연습 수 (전체 연습 기준)
-- - pending_feedback_count: 강사 피드백 미작성 연습 수 (이 강사 스크립트 기준)
-- ============================================================================

-- RETURNS TABLE 컬럼 추가 시 기존 함수 DROP 필수 (PostgreSQL 제약)
DROP FUNCTION IF EXISTS public.get_teacher_students();

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
  avg_reproduction_rate numeric,
  this_week_practices bigint,
  pending_feedback_count bigint
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
    -- 연습 수 (전체)
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
       AND p.reproduction_rate IS NOT NULL) AS avg_reproduction_rate,
    -- [NEW] 이번 주 연습 수 (전체)
    COALESCE(
      (SELECT COUNT(*)
       FROM public.practices p
       WHERE p.student_id = u.id
         AND p.deleted_at IS NULL
         AND p.created_at > now() - interval '7 days'),
      0
    ) AS this_week_practices,
    -- [NEW] 피드백 대기 수 (이 강사 스크립트 기준, 완료된 연습 중 피드백 없는 것)
    COALESCE(
      (SELECT COUNT(*)
       FROM public.practices p
       INNER JOIN public.scripts s ON s.id = p.script_id
       WHERE p.student_id = u.id
         AND s.teacher_id = v_teacher_id
         AND p.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND p.score IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.teacher_feedbacks tf
           WHERE tf.practice_id = p.id
             AND tf.deleted_at IS NULL
         )),
      0
    ) AS pending_feedback_count
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
  '강사의 연결된 학생 목록 + 통계 일괄 반환 (this_week_practices, pending_feedback_count 포함)';

-- ============================================================================
-- 4. MODIFY RPC: get_student_practice_stats
-- ============================================================================
-- 추가:
-- - prev_avg_score: 7~14일 전 평균 점수 (트렌드 표시용)
-- - prev_avg_reproduction_rate: 7~14일 전 평균 재현율
-- - target_opic_grade: teacher_student에서 조회
-- ============================================================================

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
  v_target_grade text;
BEGIN
  -- 1. 인증 확인
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 2. 인가 확인: 본인이거나 연결된 강사만 허용
  IF v_caller_id = p_student_id THEN
    -- 본인 조회: 허용
    NULL;
  ELSE
    -- 연결된 강사인지 확인
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

  -- 3. 목표 등급 조회
  -- 강사 호출 시: 해당 강사가 설정한 목표 등급
  -- 학생 본인 호출 시: 가장 최근 연결된 강사의 목표 등급
  IF v_caller_id = p_student_id THEN
    SELECT ts.target_opic_grade INTO v_target_grade
    FROM public.teacher_student ts
    WHERE ts.student_id = p_student_id
      AND ts.deleted_at IS NULL
    ORDER BY ts.created_at DESC
    LIMIT 1;
  ELSE
    SELECT ts.target_opic_grade INTO v_target_grade
    FROM public.teacher_student ts
    WHERE ts.student_id = p_student_id
      AND ts.teacher_id = v_caller_id
      AND ts.deleted_at IS NULL;
  END IF;

  -- 4. 통계 조회 (prev_avg_score, prev_avg_reproduction_rate 추가)
  SELECT jsonb_build_object(
    'total_practices', COUNT(*),
    'total_duration_minutes', COALESCE(SUM(duration) / 60, 0),
    'avg_score', COALESCE(ROUND(AVG(score)::numeric, 1), 0),
    'avg_reproduction_rate', COALESCE(ROUND(AVG(reproduction_rate)::numeric, 1), 0),
    'this_week_practices', COUNT(*) FILTER (WHERE created_at > now() - interval '7 days'),
    'last_practice_at', MAX(created_at),
    -- [NEW] 지난주 평균 점수 (7~14일 전) - 트렌드 비교용
    'prev_avg_score', (
      SELECT ROUND(AVG(p2.score)::numeric, 1)
      FROM public.practices p2
      WHERE p2.student_id = p_student_id
        AND p2.deleted_at IS NULL
        AND p2.score IS NOT NULL
        AND p2.created_at > now() - interval '14 days'
        AND p2.created_at <= now() - interval '7 days'
    ),
    -- [NEW] 지난주 평균 재현율 (7~14일 전)
    'prev_avg_reproduction_rate', (
      SELECT ROUND(AVG(p2.reproduction_rate)::numeric, 1)
      FROM public.practices p2
      WHERE p2.student_id = p_student_id
        AND p2.deleted_at IS NULL
        AND p2.reproduction_rate IS NOT NULL
        AND p2.created_at > now() - interval '14 days'
        AND p2.created_at <= now() - interval '7 days'
    ),
    -- [NEW] 목표 OPIc 등급
    'target_opic_grade', v_target_grade
  ) INTO v_result
  FROM public.practices
  WHERE student_id = p_student_id
    AND deleted_at IS NULL;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_student_practice_stats IS
  '학생 연습 통계 조회 (본인/연결 강사만 허용, 트렌드 + 목표등급 포함)';

-- ============================================================================
-- 5. MODIFY RPC: get_student_detail
-- ============================================================================
-- 추가: stats에 notes, target_opic_grade 포함
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_detail(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
  v_student record;
  v_stats jsonb;
  v_notes text;
  v_target_grade text;
BEGIN
  v_teacher_id := auth.uid();

  -- 인증 확인
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 강사-학생 연결 확인 + notes, target_opic_grade 조회
  SELECT ts.notes, ts.target_opic_grade
  INTO v_notes, v_target_grade
  FROM public.teacher_student ts
  WHERE ts.teacher_id = v_teacher_id
    AND ts.student_id = p_student_id
    AND ts.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  -- 학생 기본 정보 조회
  SELECT * INTO v_student
  FROM public.users
  WHERE id = p_student_id
    AND deleted_at IS NULL;

  IF v_student IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND');
  END IF;

  -- 통계 조회 (이 강사가 작성한 스크립트 기준)
  SELECT jsonb_build_object(
    'scripts_count', COALESCE(
      (SELECT COUNT(*)
       FROM public.scripts s
       WHERE s.student_id = p_student_id
         AND s.teacher_id = v_teacher_id
         AND s.deleted_at IS NULL),
      0
    ),
    'practices_count', COALESCE(
      (SELECT COUNT(*)
       FROM public.practices p
       INNER JOIN public.scripts s ON s.id = p.script_id
       WHERE p.student_id = p_student_id
         AND s.teacher_id = v_teacher_id
         AND p.deleted_at IS NULL
         AND s.deleted_at IS NULL),
      0
    ),
    'total_duration_minutes', COALESCE(
      (SELECT SUM(p.duration) / 60
       FROM public.practices p
       INNER JOIN public.scripts s ON s.id = p.script_id
       WHERE p.student_id = p_student_id
         AND s.teacher_id = v_teacher_id
         AND p.deleted_at IS NULL
         AND s.deleted_at IS NULL),
      0
    ),
    'avg_score', (
      SELECT ROUND(AVG(p.score)::numeric, 1)
      FROM public.practices p
      INNER JOIN public.scripts s ON s.id = p.script_id
      WHERE p.student_id = p_student_id
        AND s.teacher_id = v_teacher_id
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND p.score IS NOT NULL
    ),
    'avg_reproduction_rate', (
      SELECT ROUND(AVG(p.reproduction_rate)::numeric, 1)
      FROM public.practices p
      INNER JOIN public.scripts s ON s.id = p.script_id
      WHERE p.student_id = p_student_id
        AND s.teacher_id = v_teacher_id
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND p.reproduction_rate IS NOT NULL
    ),
    'last_practice_at', (
      SELECT MAX(p.created_at)
      FROM public.practices p
      INNER JOIN public.scripts s ON s.id = p.script_id
      WHERE p.student_id = p_student_id
        AND s.teacher_id = v_teacher_id
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
    ),
    'this_week_practices', COALESCE(
      (SELECT COUNT(*)
       FROM public.practices p
       INNER JOIN public.scripts s ON s.id = p.script_id
       WHERE p.student_id = p_student_id
         AND s.teacher_id = v_teacher_id
         AND p.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND p.created_at > now() - interval '7 days'),
      0
    ),
    'connected_at', (
      SELECT ts.created_at
      FROM public.teacher_student ts
      WHERE ts.teacher_id = v_teacher_id
        AND ts.student_id = p_student_id
        AND ts.deleted_at IS NULL
    ),
    -- [NEW] 강사 메모
    'notes', v_notes,
    -- [NEW] 목표 OPIc 등급
    'target_opic_grade', v_target_grade
  ) INTO v_stats;

  RETURN jsonb_build_object(
    'success', true,
    'student', jsonb_build_object(
      'id', v_student.id,
      'email', v_student.email,
      'name', v_student.name,
      'role', v_student.role,
      'created_at', v_student.created_at
    ),
    'stats', v_stats
  );
END;
$$;

COMMENT ON FUNCTION public.get_student_detail IS
  '학생 상세 정보 조회 (기본 정보 + 통계 + 메모 + 목표등급, 강사 본인 스크립트 기준)';

-- ============================================================================
-- 6. NEW RPC: get_practice_streak
-- ============================================================================
-- 연습 스트릭(연속 연습 일수) 계산
-- 인가: 본인 또는 연결된 강사/admin만 허용 (013 패턴)
-- TOCTOU 방지: 재귀 CTE로 단일 원자적 쿼리
-- KST 기준으로 날짜 계산
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_practice_streak(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
  v_current_streak int;
BEGIN
  -- 1. 인증 확인
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 2. 인가 확인: 본인이거나 연결된 강사만 허용
  IF v_caller_id = p_student_id THEN
    NULL; -- 본인 조회 허용
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

  -- 3. 학생 존재 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_student_id AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('error', 'STUDENT_NOT_FOUND');
  END IF;

  -- 4. 스트릭 계산 (재귀 CTE - 단일 원자적 쿼리)
  -- KST 기준 날짜 사용 (Asia/Seoul)
  -- 오늘 연습이 있으면 오늘부터, 없으면 어제부터 카운트 시작
  WITH RECURSIVE practice_dates AS (
    SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Seoul')::date AS practice_date
    FROM public.practices
    WHERE student_id = p_student_id
      AND deleted_at IS NULL
  ),
  start_point AS (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM practice_dates
          WHERE practice_date = (now() AT TIME ZONE 'Asia/Seoul')::date
        ) THEN (now() AT TIME ZONE 'Asia/Seoul')::date
        WHEN EXISTS (
          SELECT 1 FROM practice_dates
          WHERE practice_date = (now() AT TIME ZONE 'Asia/Seoul')::date - 1
        ) THEN (now() AT TIME ZONE 'Asia/Seoul')::date - 1
        ELSE NULL
      END AS start_date
  ),
  streak_calc AS (
    -- 시작점
    SELECT sp.start_date AS check_date, 1 AS days
    FROM start_point sp
    WHERE sp.start_date IS NOT NULL

    UNION ALL

    -- 하루씩 거슬러 올라가며 연속 확인 (최대 365일)
    SELECT sc.check_date - 1, sc.days + 1
    FROM streak_calc sc
    WHERE sc.days < 365
      AND EXISTS (
        SELECT 1 FROM practice_dates pd
        WHERE pd.practice_date = sc.check_date - 1
      )
  )
  SELECT COALESCE(MAX(days), 0)
  INTO v_current_streak
  FROM streak_calc;

  RETURN jsonb_build_object(
    'current_streak', v_current_streak
  );
END;
$$;

COMMENT ON FUNCTION public.get_practice_streak IS
  '학생의 연습 스트릭 조회 (KST 기준, 본인/연결 강사만 허용)';

-- ============================================================================
-- 7. NEW RPC: update_student_notes
-- ============================================================================
-- 강사가 학생의 메모와 목표 등급을 설정
-- 보안:
-- - SECURITY DEFINER (teacher_student에 UPDATE RLS 없으므로 RPC로만 수정)
-- - teacher_id = auth.uid() 소유권 검증
-- - target_opic_grade 화이트리스트 검증
-- - notes 2000자 길이 제한
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_student_notes(
  p_student_id uuid,
  p_notes text DEFAULT NULL,
  p_target_grade text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
  v_rows_affected int;
BEGIN
  -- 1. 인증 확인
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 2. 역할 확인 (강사만 허용)
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_teacher_id
      AND role = 'teacher'
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_TEACHER');
  END IF;

  -- 3. 입력값 검증: target_opic_grade 화이트리스트
  -- '' = 비우기(clear), NULL = 변경 없음, 유효 등급 = 설정
  IF p_target_grade IS NOT NULL AND p_target_grade != '' AND p_target_grade NOT IN (
    'NL', 'NM', 'NH', 'IL', 'IM1', 'IM2', 'IM3', 'IH', 'AL'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_GRADE');
  END IF;

  -- 4. 입력값 검증: notes 길이 제한 (비우기 '' 허용)
  IF p_notes IS NOT NULL AND p_notes != '' AND length(p_notes) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOTES_TOO_LONG');
  END IF;

  -- 5. 소유권 검증 + 업데이트 (원자적)
  -- 규약: NULL = 변경 없음 (부분 업데이트), '' = 비우기(clear → DB에 NULL 저장), 값 = 설정
  UPDATE public.teacher_student
  SET
    notes = CASE
      WHEN p_notes IS NULL THEN notes            -- 변경 없음
      WHEN p_notes = '' THEN NULL                -- 비우기
      ELSE p_notes                               -- 설정
    END,
    target_opic_grade = CASE
      WHEN p_target_grade IS NULL THEN target_opic_grade  -- 변경 없음
      WHEN p_target_grade = '' THEN NULL                   -- 비우기
      ELSE p_target_grade                                  -- 설정
    END
  WHERE teacher_id = v_teacher_id
    AND student_id = p_student_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.update_student_notes IS
  '강사가 학생 메모/목표등급 설정 (소유권 검증, 등급 화이트리스트, 메모 2000자 제한)';
