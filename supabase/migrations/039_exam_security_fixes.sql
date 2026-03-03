-- ============================================================================
-- 037_exam_security_fixes.sql
-- 시험 테이블 보안 강화
--
-- 근본 원인: exam_sessions/exam_responses의 UPDATE RLS가 소유권만 확인하여
--            학생이 점수/등급/평가 컬럼을 직접 조작 가능
-- 해결: protect_user_columns (012) 패턴 적용 — BEFORE UPDATE 트리거로
--        점수 관련 컬럼 변경을 authenticated/anon 사용자에게 차단
--        Edge Function (service_role = postgres)은 자동 bypass
-- ============================================================================

-- ============================================================================
-- 1. exam_sessions 보호 컬럼 트리거
--
-- 학생이 변경 가능한 컬럼 (화이트리스트):
--   status, completed_at, total_duration_sec
--
-- 서버만 변경 가능한 컬럼 (보호 대상):
--   estimated_grade, score_function, score_accuracy, score_content,
--   score_text_type, overall_score, evaluation_report, processing_status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_exam_session_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER 함수(postgres)에서 호출 = 신뢰된 서버 코드 → bypass
  -- 일반 클라이언트(authenticated, anon)만 보호 컬럼 변경 차단
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 점수/등급 컬럼 보호
  IF NEW.estimated_grade IS DISTINCT FROM OLD.estimated_grade THEN
    RAISE EXCEPTION '등급은 서버에서만 변경할 수 있습니다';
  END IF;

  IF NEW.score_function IS DISTINCT FROM OLD.score_function THEN
    RAISE EXCEPTION '점수는 서버에서만 변경할 수 있습니다';
  END IF;

  IF NEW.score_accuracy IS DISTINCT FROM OLD.score_accuracy THEN
    RAISE EXCEPTION '점수는 서버에서만 변경할 수 있습니다';
  END IF;

  IF NEW.score_content IS DISTINCT FROM OLD.score_content THEN
    RAISE EXCEPTION '점수는 서버에서만 변경할 수 있습니다';
  END IF;

  IF NEW.score_text_type IS DISTINCT FROM OLD.score_text_type THEN
    RAISE EXCEPTION '점수는 서버에서만 변경할 수 있습니다';
  END IF;

  IF NEW.overall_score IS DISTINCT FROM OLD.overall_score THEN
    RAISE EXCEPTION '점수는 서버에서만 변경할 수 있습니다';
  END IF;

  IF NEW.evaluation_report IS DISTINCT FROM OLD.evaluation_report THEN
    RAISE EXCEPTION '평가 리포트는 서버에서만 변경할 수 있습니다';
  END IF;

  IF NEW.processing_status IS DISTINCT FROM OLD.processing_status THEN
    RAISE EXCEPTION 'processing_status는 서버에서만 변경할 수 있습니다';
  END IF;

  -- student_id, exam_type, created_at 등 불변 컬럼 보호
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'student_id 변경은 허용되지 않습니다';
  END IF;

  IF NEW.exam_type IS DISTINCT FROM OLD.exam_type THEN
    RAISE EXCEPTION 'exam_type 변경은 허용되지 않습니다';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at 변경은 허용되지 않습니다';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_exam_session_columns_trigger
  BEFORE UPDATE ON public.exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_exam_session_columns();

COMMENT ON FUNCTION public.protect_exam_session_columns IS
  'exam_sessions 보호 컬럼 트리거. 점수/등급은 Edge Function(service_role)에서만 변경 가능.';

-- ============================================================================
-- 2. exam_responses 보호 컬럼 트리거
--
-- 학생이 변경 가능한 컬럼 (화이트리스트):
--   audio_url, duration_sec, transcription
--
-- 서버만 변경 가능한 컬럼 (보호 대상):
--   score, feedback, processing_status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_exam_response_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER 함수(postgres)에서 호출 → bypass
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 점수/피드백 컬럼 보호
  IF NEW.score IS DISTINCT FROM OLD.score THEN
    RAISE EXCEPTION '점수는 서버에서만 변경할 수 있습니다';
  END IF;

  IF NEW.feedback IS DISTINCT FROM OLD.feedback THEN
    RAISE EXCEPTION '피드백은 서버에서만 변경할 수 있습니다';
  END IF;

  IF NEW.processing_status IS DISTINCT FROM OLD.processing_status THEN
    RAISE EXCEPTION 'processing_status는 서버에서만 변경할 수 있습니다';
  END IF;

  -- 불변 컬럼 보호
  IF NEW.exam_session_id IS DISTINCT FROM OLD.exam_session_id THEN
    RAISE EXCEPTION 'exam_session_id 변경은 허용되지 않습니다';
  END IF;

  IF NEW.question_id IS DISTINCT FROM OLD.question_id THEN
    RAISE EXCEPTION 'question_id 변경은 허용되지 않습니다';
  END IF;

  IF NEW.roleplay_question_id IS DISTINCT FROM OLD.roleplay_question_id THEN
    RAISE EXCEPTION 'roleplay_question_id 변경은 허용되지 않습니다';
  END IF;

  IF NEW.question_order IS DISTINCT FROM OLD.question_order THEN
    RAISE EXCEPTION 'question_order 변경은 허용되지 않습니다';
  END IF;

  IF NEW.is_scored IS DISTINCT FROM OLD.is_scored THEN
    RAISE EXCEPTION 'is_scored 변경은 허용되지 않습니다';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at 변경은 허용되지 않습니다';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_exam_response_columns_trigger
  BEFORE UPDATE ON public.exam_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_exam_response_columns();

COMMENT ON FUNCTION public.protect_exam_response_columns IS
  'exam_responses 보호 컬럼 트리거. 점수/피드백은 Edge Function(service_role)에서만 변경 가능.';

-- ============================================================================
-- 3. organization_id 검증 — INSERT 시 소속 확인
--
-- 근본 원인: 클라이언트가 임의 organization_id를 전달하여
--            소속되지 않은 조직에 시험 연결 가능
-- 해결: BEFORE INSERT 트리거로 organization_members 테이블 검증
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_exam_session_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER 함수에서 호출 → bypass
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- organization_id가 NULL이면 검증 불필요
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 학생이 해당 조직의 멤버인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = NEW.student_id
      AND om.organization_id = NEW.organization_id
      AND om.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION '소속되지 않은 조직에는 시험을 생성할 수 없습니다';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_exam_session_org_trigger
  BEFORE INSERT ON public.exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_exam_session_org();

-- ============================================================================
-- 4. RPC 역할 검증 추가 — generate_mock_exam_questions
--
-- 근본 원인: check_exam_availability는 student 역할 검증하지만
--            문제 생성 RPC는 역할 검증 없음 (일관성 결여)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_mock_exam_questions(
  p_self_assessment int,
  p_survey_topic_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_question_order int := 1;
  v_combo_number int := 1;
  v_topic_id uuid;
  v_unexpected_topic_id uuid;
  v_q record;
  v_scenario record;
  v_rq record;
  v_survey_topics uuid[];
  v_total_questions int;
BEGIN
  -- 인증
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 역할 검증: organization_members에서 student 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = v_user_id AND om.role = 'student' AND om.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_STUDENT');
  END IF;

  -- 입력 검증
  IF p_self_assessment IS NULL OR p_self_assessment < 1 OR p_self_assessment > 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'VAL_FAILED');
  END IF;

  IF p_survey_topic_ids IS NULL OR array_length(p_survey_topic_ids, 1) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'VAL_FAILED');
  END IF;

  -- 문항 수 결정 (레벨 1-2: 12문항, 3-6: 15문항)
  v_total_questions := CASE WHEN p_self_assessment <= 2 THEN 12 ELSE 15 END;

  -- 서베이 토픽 셔플
  SELECT array_agg(tid ORDER BY random()) INTO v_survey_topics
  FROM unnest(p_survey_topic_ids) AS tid;

  -- === Q1: 자기소개 (채점 안 함) ===
  SELECT q.id, q.question_text INTO v_q
  FROM public.questions q
  JOIN public.topics t ON t.id = q.topic_id
  WHERE t.name_en = 'Self Introduction'
    AND q.question_type = 'describe'
  ORDER BY random()
  LIMIT 1;

  IF v_q.id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'question_order', v_question_order,
      'question_id', v_q.id,
      'question_text', v_q.question_text,
      'question_type', 'describe',
      'is_scored', false,
      'combo_number', NULL,
      'combo_position', NULL,
      'source', 'question'
    );
    v_question_order := v_question_order + 1;
  END IF;

  -- === Q2-Q4: 서베이 토픽 콤보1 (describe → routine → experience) ===
  v_topic_id := v_survey_topics[1];
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type
    FROM public.questions q
    WHERE q.topic_id = v_topic_id
      AND q.question_type IN ('describe', 'routine', 'experience')
    ORDER BY
      CASE q.question_type
        WHEN 'describe' THEN 1
        WHEN 'routine' THEN 2
        WHEN 'experience' THEN 3
      END,
      random()
  LOOP
    IF v_question_order > 4 THEN EXIT; END IF;

    v_result := v_result || jsonb_build_object(
      'question_order', v_question_order,
      'question_id', v_q.id,
      'question_text', v_q.question_text,
      'question_type', v_q.question_type,
      'is_scored', true,
      'combo_number', v_combo_number,
      'combo_position', v_question_order - 1,
      'source', 'question'
    );
    v_question_order := v_question_order + 1;
  END LOOP;
  v_combo_number := v_combo_number + 1;

  -- === Q5-Q7: 서베이 토픽 콤보2 (describe → comparison → experience) ===
  v_topic_id := v_survey_topics[2];
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type
    FROM public.questions q
    WHERE q.topic_id = v_topic_id
      AND q.question_type IN ('describe', 'comparison', 'experience')
    ORDER BY
      CASE q.question_type
        WHEN 'describe' THEN 1
        WHEN 'comparison' THEN 2
        WHEN 'experience' THEN 3
      END,
      random()
  LOOP
    IF v_question_order > 7 THEN EXIT; END IF;

    v_result := v_result || jsonb_build_object(
      'question_order', v_question_order,
      'question_id', v_q.id,
      'question_text', v_q.question_text,
      'question_type', v_q.question_type,
      'is_scored', true,
      'combo_number', v_combo_number,
      'combo_position', v_question_order - 4,
      'source', 'question'
    );
    v_question_order := v_question_order + 1;
  END LOOP;
  v_combo_number := v_combo_number + 1;

  -- === Q8-Q10: 돌발 토픽 콤보3 (describe → routine → experience) ===
  SELECT t.id INTO v_unexpected_topic_id
  FROM public.topics t
  WHERE t.category = 'unexpected'
    AND t.id != ALL(p_survey_topic_ids)
  ORDER BY random()
  LIMIT 1;

  IF v_unexpected_topic_id IS NOT NULL THEN
    FOR v_q IN
      SELECT q.id, q.question_text, q.question_type
      FROM public.questions q
      WHERE q.topic_id = v_unexpected_topic_id
        AND q.question_type IN ('describe', 'routine', 'experience')
      ORDER BY
        CASE q.question_type
          WHEN 'describe' THEN 1
          WHEN 'routine' THEN 2
          WHEN 'experience' THEN 3
        END,
        random()
    LOOP
      IF v_question_order > 10 THEN EXIT; END IF;

      v_result := v_result || jsonb_build_object(
        'question_order', v_question_order,
        'question_id', v_q.id,
        'question_text', v_q.question_text,
        'question_type', v_q.question_type,
        'is_scored', true,
        'combo_number', v_combo_number,
        'combo_position', v_question_order - 7,
        'source', 'question'
      );
      v_question_order := v_question_order + 1;
    END LOOP;
    v_combo_number := v_combo_number + 1;
  END IF;

  -- === Q11-Q13: 롤플레이 콤보 ===
  SELECT rs.id INTO v_scenario
  FROM public.roleplay_scenarios rs
  WHERE rs.is_active = true
    AND rs.difficulty <= p_self_assessment + 1
  ORDER BY random()
  LIMIT 1;

  IF v_scenario.id IS NOT NULL THEN
    FOR v_rq IN
      SELECT rq.id, rq.question_text, rq.roleplay_type, rq.position
      FROM public.roleplay_scenario_questions rq
      WHERE rq.scenario_id = v_scenario.id
      ORDER BY rq.position
    LOOP
      IF v_question_order > 13 THEN EXIT; END IF;

      v_result := v_result || jsonb_build_object(
        'question_order', v_question_order,
        'roleplay_question_id', v_rq.id,
        'question_text', v_rq.question_text,
        'question_type', v_rq.roleplay_type,
        'is_scored', true,
        'combo_number', v_combo_number,
        'combo_position', v_rq.position,
        'source', 'roleplay_question'
      );
      v_question_order := v_question_order + 1;
    END LOOP;
    v_combo_number := v_combo_number + 1;
  END IF;

  -- === Q14-Q15: 어드밴스(레벨5-6) 또는 추가 질문(레벨3-4) ===
  IF v_total_questions >= 15 THEN
    IF p_self_assessment >= 5 THEN
      FOR v_q IN
        SELECT q.id, q.question_text, q.question_type
        FROM public.questions q
        WHERE q.question_type IN ('advanced', 'comparison')
          AND q.difficulty >= 5
        ORDER BY random()
        LIMIT 2
      LOOP
        IF v_question_order > 15 THEN EXIT; END IF;

        v_result := v_result || jsonb_build_object(
          'question_order', v_question_order,
          'question_id', v_q.id,
          'question_text', v_q.question_text,
          'question_type', v_q.question_type,
          'is_scored', true,
          'combo_number', NULL,
          'combo_position', NULL,
          'source', 'question'
        );
        v_question_order := v_question_order + 1;
      END LOOP;
    ELSE
      v_topic_id := v_survey_topics[3];
      FOR v_q IN
        SELECT q.id, q.question_text, q.question_type
        FROM public.questions q
        WHERE q.topic_id = v_topic_id
        ORDER BY random()
        LIMIT 2
      LOOP
        IF v_question_order > 15 THEN EXIT; END IF;

        v_result := v_result || jsonb_build_object(
          'question_order', v_question_order,
          'question_id', v_q.id,
          'question_text', v_q.question_text,
          'question_type', v_q.question_type,
          'is_scored', true,
          'combo_number', NULL,
          'combo_position', NULL,
          'source', 'question'
        );
        v_question_order := v_question_order + 1;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'questions', v_result,
    'total_count', jsonb_array_length(v_result),
    'exam_type', 'mock_exam'
  );
END;
$$;

-- ============================================================================
-- 5. RPC 역할 검증 추가 — generate_level_test_questions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_level_test_questions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_question_order int := 1;
  v_q record;
BEGIN
  -- 인증
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 역할 검증: organization_members에서 student 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = v_user_id AND om.role = 'student' AND om.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_STUDENT');
  END IF;

  -- 1문항: 쉬운 (difficulty 2, describe)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty
    FROM public.questions q
    WHERE q.difficulty = 2 AND q.question_type = 'describe'
    ORDER BY random()
    LIMIT 1
  LOOP
    v_result := v_result || jsonb_build_object(
      'question_order', v_question_order,
      'question_id', v_q.id,
      'question_text', v_q.question_text,
      'question_type', v_q.question_type,
      'is_scored', true,
      'combo_number', NULL,
      'combo_position', NULL,
      'source', 'question'
    );
    v_question_order := v_question_order + 1;
  END LOOP;

  -- 2문항: 중간 (difficulty 3-4, routine/experience)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty
    FROM public.questions q
    WHERE q.difficulty BETWEEN 3 AND 4
      AND q.question_type IN ('routine', 'experience')
    ORDER BY random()
    LIMIT 2
  LOOP
    v_result := v_result || jsonb_build_object(
      'question_order', v_question_order,
      'question_id', v_q.id,
      'question_text', v_q.question_text,
      'question_type', v_q.question_type,
      'is_scored', true,
      'combo_number', NULL,
      'combo_position', NULL,
      'source', 'question'
    );
    v_question_order := v_question_order + 1;
  END LOOP;

  -- 2문항: 어려운 (difficulty 5, comparison/roleplay)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty
    FROM public.questions q
    WHERE q.difficulty = 5
      AND q.question_type IN ('comparison', 'roleplay')
    ORDER BY random()
    LIMIT 2
  LOOP
    v_result := v_result || jsonb_build_object(
      'question_order', v_question_order,
      'question_id', v_q.id,
      'question_text', v_q.question_text,
      'question_type', v_q.question_type,
      'is_scored', true,
      'combo_number', NULL,
      'combo_position', NULL,
      'source', 'question'
    );
    v_question_order := v_question_order + 1;
  END LOOP;

  -- 1문항: 고급 (difficulty 6 또는 5, advanced)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty
    FROM public.questions q
    WHERE q.difficulty >= 5
      AND q.question_type = 'advanced'
    ORDER BY random()
    LIMIT 1
  LOOP
    v_result := v_result || jsonb_build_object(
      'question_order', v_question_order,
      'question_id', v_q.id,
      'question_text', v_q.question_text,
      'question_type', v_q.question_type,
      'is_scored', true,
      'combo_number', NULL,
      'combo_position', NULL,
      'source', 'question'
    );
    v_question_order := v_question_order + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'questions', v_result,
    'total_count', jsonb_array_length(v_result),
    'exam_type', 'level_test'
  );
END;
$$;
