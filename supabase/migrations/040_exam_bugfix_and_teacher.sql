-- ============================================================================
-- 040_exam_bugfix_and_teacher.sql
--
-- 1. check_exam_availability: jsonb dot notation 버그 수정 (036:55-60)
--    - check_api_rate_limit()이 RETURNS jsonb인데 r.allowed 같은 dot notation 사용
--    - PostgreSQL에서 jsonb 스칼라에 dot notation 불가 → 런타임 에러
--    - 수정: SELECT ... INTO v_rate_limit 직접 할당
--
-- 2. 3개 RPC 역할 완화: om.role = 'student' → IN ('student','teacher','owner')
--    - 강사/원장도 시험 기능 사용 가능하도록
-- ============================================================================

-- ============================================================================
-- 1. check_exam_availability — 버그 수정 + 역할 완화
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_exam_availability(
  p_exam_type text,
  p_question_count int DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_recent_exams int;
  v_rate_limit jsonb;
BEGIN
  -- 인증
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 역할 검증: organization_members에서 학생/강사/원장 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = v_user_id
      AND om.role IN ('student', 'teacher', 'owner')
      AND om.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_MEMBER');
  END IF;

  -- 최근 1시간 내 시험 횟수 (abandoned 제외)
  SELECT COUNT(*) INTO v_recent_exams
  FROM public.exam_sessions es
  WHERE es.student_id = v_user_id
    AND es.deleted_at IS NULL
    AND es.status IN ('in_progress', 'completed')
    AND es.created_at > now() - interval '1 hour';

  IF v_recent_exams >= 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXAM_RATE_LIMIT',
      'exams_remaining', 0
    );
  END IF;

  -- Whisper rate limit 확인 (문항 수만큼 필요)
  -- 수정: check_api_rate_limit()은 RETURNS jsonb이므로 직접 할당
  SELECT public.check_api_rate_limit(v_user_id, 'whisper', 30, 60)
  INTO v_rate_limit;

  IF v_rate_limit IS NOT NULL
     AND (v_rate_limit->>'remaining')::int < p_question_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXAM_INSUFFICIENT_QUOTA',
      'whisper_remaining', (v_rate_limit->>'remaining')::int,
      'needed', p_question_count
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'exams_remaining', 2 - v_recent_exams,
    'whisper_remaining', COALESCE((v_rate_limit->>'remaining')::int, 30)
  );
END;
$$;

-- ============================================================================
-- 2. generate_mock_exam_questions — 역할 완화
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

  -- 역할 검증: 학생/강사/원장 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = v_user_id
      AND om.role IN ('student', 'teacher', 'owner')
      AND om.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_MEMBER');
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
-- 3. generate_level_test_questions — 역할 완화
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

  -- 역할 검증: 학생/강사/원장 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = v_user_id
      AND om.role IN ('student', 'teacher', 'owner')
      AND om.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_MEMBER');
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
