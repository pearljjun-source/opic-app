-- ============================================================================
-- OPIc 학습 앱 - 주제 기반 네비게이션
-- ============================================================================
-- 변경 사항:
-- 1. 토픽 아이콘: 이모지 → Ionicons 이름으로 변경
-- 2. student_topics INSERT 정책 수정 (강사도 배정 가능)
-- 3. RPC: set_student_topics (강사가 토픽 배정)
-- 4. RPC: get_student_topics_with_progress (배정 토픽 + 진행 통계)
-- 5. RPC: get_topic_questions_with_scripts (토픽별 질문 + 스크립트 현황)
-- 6. soft_delete_connection cascade에 student_topics 추가
-- ============================================================================

-- ============================================================================
-- 1. 토픽 아이콘 변경 (이모지 → Ionicons)
-- ============================================================================

UPDATE public.topics SET icon = 'person-outline' WHERE name_en = 'Self Introduction';
UPDATE public.topics SET icon = 'home-outline' WHERE name_en = 'Home/Housing';
UPDATE public.topics SET icon = 'map-outline' WHERE name_en = 'Neighborhood';
UPDATE public.topics SET icon = 'musical-notes-outline' WHERE name_en = 'Listening to Music';
UPDATE public.topics SET icon = 'film-outline' WHERE name_en = 'Watching Movies';
UPDATE public.topics SET icon = 'tv-outline' WHERE name_en = 'Watching TV';
UPDATE public.topics SET icon = 'cart-outline' WHERE name_en = 'Shopping';
UPDATE public.topics SET icon = 'restaurant-outline' WHERE name_en = 'Cooking/Food';
UPDATE public.topics SET icon = 'fitness-outline' WHERE name_en = 'Exercise/Fitness';
UPDATE public.topics SET icon = 'airplane-outline' WHERE name_en = 'Travel/Vacation';
UPDATE public.topics SET icon = 'call-outline' WHERE name_en = 'Phone Calls';
UPDATE public.topics SET icon = 'globe-outline' WHERE name_en = 'Internet/SNS';

-- ============================================================================
-- 2. student_topics INSERT 정책 수정
-- 강사도 연결된 학생의 토픽을 배정할 수 있도록 변경
-- (기존: 학생 본인만 INSERT → 새: 학생 본인 OR 연결된 강사)
-- ============================================================================

DROP POLICY IF EXISTS "student_topics_insert" ON public.student_topics;

CREATE POLICY "student_topics_insert" ON public.student_topics
  FOR INSERT WITH CHECK (
    -- 학생 본인
    (student_id = auth.uid() AND public.get_user_role(auth.uid()) = 'student')
    OR
    -- 연결된 강사
    (public.get_user_role(auth.uid()) = 'teacher'
     AND public.is_connected_student(auth.uid(), student_id))
  );

-- student_topics UPDATE 정책도 강사 허용 추가
DROP POLICY IF EXISTS "student_topics_update" ON public.student_topics;

CREATE POLICY "student_topics_update" ON public.student_topics
  FOR UPDATE USING (
    deleted_at IS NULL
    AND (
      (student_id = auth.uid() AND public.get_user_role(auth.uid()) = 'student')
      OR
      (public.get_user_role(auth.uid()) = 'teacher'
       AND public.is_connected_student(auth.uid(), student_id))
    )
  )
  WITH CHECK (
    (student_id = auth.uid())
    OR
    (public.get_user_role(auth.uid()) = 'teacher'
     AND public.is_connected_student(auth.uid(), student_id))
  );

-- ============================================================================
-- 3. RPC: set_student_topics (강사가 학생에게 토픽 배정)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_student_topics(
  p_student_id uuid,
  p_topic_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
  v_user_role public.user_role;
  v_topic_id uuid;
BEGIN
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 강사 역할 검증
  SELECT role INTO v_user_role FROM public.users
  WHERE id = v_teacher_id AND deleted_at IS NULL;

  IF v_user_role IS NULL OR v_user_role != 'teacher' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_TEACHER');
  END IF;

  -- 연결 검증
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = v_teacher_id
      AND student_id = p_student_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  -- 기존 배정 hard delete (junction 테이블이므로 감사 불필요)
  DELETE FROM public.student_topics
  WHERE student_id = p_student_id;

  -- 새 토픽 배정
  FOREACH v_topic_id IN ARRAY p_topic_ids
  LOOP
    IF EXISTS (SELECT 1 FROM public.topics WHERE id = v_topic_id AND is_active = true) THEN
      INSERT INTO public.student_topics (student_id, topic_id)
      VALUES (p_student_id, v_topic_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.set_student_topics IS '강사가 학생에게 토픽 배정 (기존 배정 교체)';

-- ============================================================================
-- 4. RPC: get_student_topics_with_progress
-- 배정된 토픽 목록 + 각 토픽별 진행 통계
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_topics_with_progress(
  p_student_id uuid
)
RETURNS TABLE (
  topic_id uuid,
  topic_name_ko text,
  topic_name_en text,
  topic_icon text,
  topic_sort_order integer,
  total_questions bigint,
  scripts_count bigint,
  practices_count bigint,
  best_avg_score numeric,
  last_practice_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  -- 권한 검증: 본인 또는 연결된 강사
  SELECT role INTO v_caller_role FROM public.users
  WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role = 'student' AND v_caller_id != p_student_id THEN
    RETURN;
  END IF;

  IF v_caller_role = 'teacher' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id
        AND student_id = p_student_id
        AND deleted_at IS NULL
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    t.id AS topic_id,
    t.name_ko AS topic_name_ko,
    t.name_en AS topic_name_en,
    t.icon AS topic_icon,
    t.sort_order AS topic_sort_order,
    -- 토픽의 전체 질문 수
    (SELECT COUNT(*) FROM public.questions q
     WHERE q.topic_id = t.id AND q.is_active = true) AS total_questions,
    -- 이 학생에게 작성된 스크립트 수
    (SELECT COUNT(*) FROM public.scripts s
     JOIN public.questions q2 ON q2.id = s.question_id
     WHERE s.student_id = p_student_id
       AND q2.topic_id = t.id
       AND s.deleted_at IS NULL
       AND s.status = 'complete') AS scripts_count,
    -- 연습 횟수
    (SELECT COUNT(*) FROM public.practices p
     JOIN public.scripts s2 ON s2.id = p.script_id
     JOIN public.questions q3 ON q3.id = s2.question_id
     WHERE p.student_id = p_student_id
       AND q3.topic_id = t.id
       AND p.deleted_at IS NULL
       AND s2.deleted_at IS NULL) AS practices_count,
    -- 최고 평균 점수
    (SELECT ROUND(AVG(p2.score)::numeric, 1)
     FROM public.practices p2
     JOIN public.scripts s3 ON s3.id = p2.script_id
     JOIN public.questions q4 ON q4.id = s3.question_id
     WHERE p2.student_id = p_student_id
       AND q4.topic_id = t.id
       AND p2.deleted_at IS NULL
       AND s3.deleted_at IS NULL
       AND p2.score IS NOT NULL) AS best_avg_score,
    -- 마지막 연습 시간
    (SELECT MAX(p3.created_at)
     FROM public.practices p3
     JOIN public.scripts s4 ON s4.id = p3.script_id
     JOIN public.questions q5 ON q5.id = s4.question_id
     WHERE p3.student_id = p_student_id
       AND q5.topic_id = t.id
       AND p3.deleted_at IS NULL
       AND s4.deleted_at IS NULL) AS last_practice_at
  FROM public.student_topics st
  JOIN public.topics t ON t.id = st.topic_id AND t.is_active = true
  WHERE st.student_id = p_student_id
    AND st.deleted_at IS NULL
  ORDER BY t.sort_order ASC;
END;
$$;

COMMENT ON FUNCTION public.get_student_topics_with_progress IS '학생의 배정 토픽 + 진행 통계 조회';

-- ============================================================================
-- 5. RPC: get_topic_questions_with_scripts
-- 토픽별 질문 목록 + 각 질문의 스크립트/연습 현황
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_topic_questions_with_scripts(
  p_student_id uuid,
  p_topic_id uuid
)
RETURNS TABLE (
  question_id uuid,
  question_text text,
  question_type public.question_type,
  difficulty integer,
  hint_ko text,
  audio_url text,
  sort_order integer,
  script_id uuid,
  script_content text,
  script_status public.script_status,
  script_created_at timestamptz,
  practices_count bigint,
  last_practice_at timestamptz,
  best_score integer,
  best_reproduction_rate integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  -- 권한 검증: 본인 또는 연결된 강사
  SELECT role INTO v_caller_role FROM public.users
  WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role = 'student' AND v_caller_id != p_student_id THEN
    RETURN;
  END IF;

  IF v_caller_role = 'teacher' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id
        AND student_id = p_student_id
        AND deleted_at IS NULL
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    q.id AS question_id,
    q.question_text,
    q.question_type,
    q.difficulty,
    q.hint_ko,
    q.audio_url,
    q.sort_order,
    -- 최신 스크립트 (있으면)
    s.id AS script_id,
    s.content AS script_content,
    s.status AS script_status,
    s.created_at AS script_created_at,
    -- 연습 통계
    COALESCE(
      (SELECT COUNT(*) FROM public.practices p
       WHERE p.script_id = s.id AND p.deleted_at IS NULL),
      0
    ) AS practices_count,
    (SELECT MAX(p2.created_at) FROM public.practices p2
     WHERE p2.script_id = s.id AND p2.deleted_at IS NULL) AS last_practice_at,
    (SELECT MAX(p3.score) FROM public.practices p3
     WHERE p3.script_id = s.id AND p3.deleted_at IS NULL AND p3.score IS NOT NULL) AS best_score,
    (SELECT MAX(p4.reproduction_rate) FROM public.practices p4
     WHERE p4.script_id = s.id AND p4.deleted_at IS NULL AND p4.reproduction_rate IS NOT NULL) AS best_reproduction_rate
  FROM public.questions q
  LEFT JOIN LATERAL (
    SELECT sc.*
    FROM public.scripts sc
    WHERE sc.question_id = q.id
      AND sc.student_id = p_student_id
      AND sc.deleted_at IS NULL
      AND sc.status = 'complete'
    ORDER BY sc.created_at DESC
    LIMIT 1
  ) s ON true
  WHERE q.topic_id = p_topic_id
    AND q.is_active = true
  ORDER BY q.sort_order ASC;
END;
$$;

COMMENT ON FUNCTION public.get_topic_questions_with_scripts IS '토픽별 질문 + 스크립트/연습 현황 조회';

-- ============================================================================
-- 6. soft_delete_connection cascade에 student_topics 추가
-- 연결 해제 시 student_topics도 soft delete
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_connection(p_connection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_teacher_id uuid;
  v_student_id uuid;
BEGIN
  v_caller_id := auth.uid();

  -- 연결 정보 확인
  SELECT teacher_id, student_id INTO v_teacher_id, v_student_id
  FROM public.teacher_student
  WHERE id = p_connection_id AND deleted_at IS NULL;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- 강사 또는 학생만 해제 가능
  IF v_caller_id != v_teacher_id AND v_caller_id != v_student_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- 연결 Soft Delete
  UPDATE public.teacher_student
  SET deleted_at = now()
  WHERE id = p_connection_id AND deleted_at IS NULL;

  -- 해당 학생을 강사의 모든 반에서 제거
  UPDATE public.class_members SET deleted_at = now()
  WHERE student_id = v_student_id
    AND class_id IN (
      SELECT id FROM public.classes
      WHERE teacher_id = v_teacher_id AND deleted_at IS NULL
    )
    AND deleted_at IS NULL;

  -- [NEW] 해당 학생의 토픽 배정도 soft delete
  UPDATE public.student_topics SET deleted_at = now()
  WHERE student_id = v_student_id
    AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_connection IS '강사-학생 연결 해제 + 반 멤버십/토픽 배정 cascade (Soft Delete)';
