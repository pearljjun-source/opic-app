-- ============================================================================
-- OPIc 학습 앱 - 학생 상세 화면용 RPC 함수
-- ============================================================================
-- 변경 사항:
-- 1. get_student_scripts: 특정 학생의 스크립트 목록 반환
-- 2. get_student_practices: 특정 학생의 연습 기록 목록 반환
--
-- 설계 원칙:
-- - 강사가 본인이 작성한 스크립트/연관 연습만 조회 가능
-- - N+1 쿼리 방지: 필요한 모든 정보를 JOIN으로 한 번에 조회
-- - 모든 쿼리에 deleted_at IS NULL 조건 적용
-- ============================================================================

-- ============================================================================
-- 1. get_student_scripts: 학생의 스크립트 목록 조회
-- ============================================================================
-- 강사가 특정 학생에게 작성한 스크립트 목록을 반환
-- 각 스크립트의 질문/토픽 정보와 연습 통계 포함
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_scripts(p_student_id uuid)
RETURNS TABLE (
  id uuid,
  student_id uuid,
  teacher_id uuid,
  question_id uuid,
  content text,
  comment text,
  status public.script_status,
  created_at timestamptz,
  updated_at timestamptz,
  -- 질문 정보
  question_text text,
  question_type public.question_type,
  difficulty int,
  hint_ko text,
  -- 토픽 정보
  topic_id uuid,
  topic_name_ko text,
  topic_name_en text,
  topic_icon text,
  -- 연습 통계
  practices_count bigint,
  last_practice_at timestamptz,
  best_score int,
  best_reproduction_rate int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  v_teacher_id := auth.uid();

  -- 인증 확인
  IF v_teacher_id IS NULL THEN
    RETURN;
  END IF;

  -- 강사-학생 연결 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_student ts
    WHERE ts.teacher_id = v_teacher_id
      AND ts.student_id = p_student_id
      AND ts.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.student_id,
    s.teacher_id,
    s.question_id,
    s.content,
    s.comment,
    s.status,
    s.created_at,
    s.updated_at,
    -- 질문 정보
    q.question_text,
    q.question_type,
    q.difficulty,
    q.hint_ko,
    -- 토픽 정보
    t.id AS topic_id,
    t.name_ko AS topic_name_ko,
    t.name_en AS topic_name_en,
    t.icon AS topic_icon,
    -- 연습 통계
    COALESCE(
      (SELECT COUNT(*)
       FROM public.practices p
       WHERE p.script_id = s.id
         AND p.deleted_at IS NULL),
      0
    ) AS practices_count,
    (SELECT MAX(p.created_at)
     FROM public.practices p
     WHERE p.script_id = s.id
       AND p.deleted_at IS NULL) AS last_practice_at,
    (SELECT MAX(p.score)
     FROM public.practices p
     WHERE p.script_id = s.id
       AND p.deleted_at IS NULL
       AND p.score IS NOT NULL) AS best_score,
    (SELECT MAX(p.reproduction_rate)
     FROM public.practices p
     WHERE p.script_id = s.id
       AND p.deleted_at IS NULL
       AND p.reproduction_rate IS NOT NULL) AS best_reproduction_rate
  FROM public.scripts s
  INNER JOIN public.questions q ON q.id = s.question_id
  INNER JOIN public.topics t ON t.id = q.topic_id
  WHERE s.student_id = p_student_id
    AND s.teacher_id = v_teacher_id
    AND s.deleted_at IS NULL
  ORDER BY s.updated_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_student_scripts IS
  '강사가 특정 학생에게 작성한 스크립트 목록 조회 (질문/토픽 정보 + 연습 통계 포함)';

-- ============================================================================
-- 2. get_student_practices: 학생의 연습 기록 목록 조회
-- ============================================================================
-- 특정 학생의 연습 기록을 반환
-- 각 연습의 스크립트/질문/토픽 정보 포함
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_practices(p_student_id uuid)
RETURNS TABLE (
  id uuid,
  student_id uuid,
  script_id uuid,
  audio_url text,
  transcription text,
  score int,
  reproduction_rate int,
  feedback jsonb,
  duration int,
  created_at timestamptz,
  -- 스크립트 정보
  script_content text,
  script_status public.script_status,
  -- 질문 정보
  question_id uuid,
  question_text text,
  question_type public.question_type,
  difficulty int,
  -- 토픽 정보
  topic_id uuid,
  topic_name_ko text,
  topic_name_en text,
  topic_icon text,
  -- 강사 피드백
  teacher_feedback_id uuid,
  teacher_feedback_text text,
  teacher_feedback_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  v_teacher_id := auth.uid();

  -- 인증 확인
  IF v_teacher_id IS NULL THEN
    RETURN;
  END IF;

  -- 강사-학생 연결 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_student ts
    WHERE ts.teacher_id = v_teacher_id
      AND ts.student_id = p_student_id
      AND ts.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.student_id,
    p.script_id,
    p.audio_url,
    p.transcription,
    p.score,
    p.reproduction_rate,
    p.feedback,
    p.duration,
    p.created_at,
    -- 스크립트 정보
    s.content AS script_content,
    s.status AS script_status,
    -- 질문 정보
    q.id AS question_id,
    q.question_text,
    q.question_type,
    q.difficulty,
    -- 토픽 정보
    t.id AS topic_id,
    t.name_ko AS topic_name_ko,
    t.name_en AS topic_name_en,
    t.icon AS topic_icon,
    -- 강사 피드백
    tf.id AS teacher_feedback_id,
    tf.feedback AS teacher_feedback_text,
    tf.created_at AS teacher_feedback_at
  FROM public.practices p
  INNER JOIN public.scripts s ON s.id = p.script_id
  INNER JOIN public.questions q ON q.id = s.question_id
  INNER JOIN public.topics t ON t.id = q.topic_id
  LEFT JOIN public.teacher_feedbacks tf
    ON tf.practice_id = p.id
    AND tf.deleted_at IS NULL
  WHERE p.student_id = p_student_id
    AND s.teacher_id = v_teacher_id
    AND p.deleted_at IS NULL
    AND s.deleted_at IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_student_practices IS
  '특정 학생의 연습 기록 목록 조회 (스크립트/질문/토픽 정보 + 강사 피드백 포함)';

-- ============================================================================
-- 3. get_student_detail: 학생 상세 정보 조회 (기본 정보 + 통계)
-- ============================================================================
-- 학생 기본 정보와 연습 통계를 한 번에 반환
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
BEGIN
  v_teacher_id := auth.uid();

  -- 인증 확인
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 강사-학생 연결 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_student ts
    WHERE ts.teacher_id = v_teacher_id
      AND ts.student_id = p_student_id
      AND ts.deleted_at IS NULL
  ) THEN
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
    )
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
  '학생 상세 정보 조회 (기본 정보 + 통계, 강사 본인 스크립트 기준)';
