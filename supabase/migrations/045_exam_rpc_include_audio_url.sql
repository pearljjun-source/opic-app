-- ============================================================================
-- 045_exam_rpc_include_audio_url.sql
-- 근본 원인: 문항 생성 RPC가 questions.audio_url을 반환하지 않아
-- 매 "질문 듣기" 클릭마다 Edge Function 호출 필요 → 지연 발생
-- 해결: RPC 반환값에 audio_url 포함 → DB 캐시 히트 시 네트워크 호출 0회
-- ============================================================================

-- ============================================================================
-- 1. generate_mock_exam_questions — audio_url 포함
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
  SELECT q.id, q.question_text, q.audio_url INTO v_q
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
      'source', 'question',
      'audio_url', v_q.audio_url
    );
    v_question_order := v_question_order + 1;
  END IF;

  -- === Q2-Q4: 서베이 토픽 콤보1 (describe → routine → experience) ===
  v_topic_id := v_survey_topics[1];
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.audio_url
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
    -- 콤보당 3문항만
    IF v_question_order > 4 THEN EXIT; END IF;

    v_result := v_result || jsonb_build_object(
      'question_order', v_question_order,
      'question_id', v_q.id,
      'question_text', v_q.question_text,
      'question_type', v_q.question_type,
      'is_scored', true,
      'combo_number', v_combo_number,
      'combo_position', v_question_order - 1,
      'source', 'question',
      'audio_url', v_q.audio_url
    );
    v_question_order := v_question_order + 1;
  END LOOP;
  v_combo_number := v_combo_number + 1;

  -- === Q5-Q7: 서베이 토픽 콤보2 (describe → comparison → experience) ===
  v_topic_id := v_survey_topics[2];
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.audio_url
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
      'source', 'question',
      'audio_url', v_q.audio_url
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
      SELECT q.id, q.question_text, q.question_type, q.audio_url
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
        'source', 'question',
        'audio_url', v_q.audio_url
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

  -- === Q14-Q15: 어드밴스(레벨5-6) 또는 두번째 롤플레이(레벨3-4) ===
  IF v_total_questions >= 15 THEN
    IF p_self_assessment >= 5 THEN
      -- 어드밴스 질문 2개
      FOR v_q IN
        SELECT q.id, q.question_text, q.question_type, q.audio_url
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
          'source', 'question',
          'audio_url', v_q.audio_url
        );
        v_question_order := v_question_order + 1;
      END LOOP;
    ELSE
      -- 서베이 토픽에서 추가 질문 2개
      v_topic_id := v_survey_topics[3];
      FOR v_q IN
        SELECT q.id, q.question_text, q.question_type, q.audio_url
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
          'source', 'question',
          'audio_url', v_q.audio_url
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
-- 2. generate_level_test_questions — audio_url 포함
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

  -- 1문항: 쉬운 (difficulty 2, describe)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty, q.audio_url
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
      'source', 'question',
      'audio_url', v_q.audio_url
    );
    v_question_order := v_question_order + 1;
  END LOOP;

  -- 2문항: 중간 (difficulty 3-4, routine/experience)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty, q.audio_url
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
      'source', 'question',
      'audio_url', v_q.audio_url
    );
    v_question_order := v_question_order + 1;
  END LOOP;

  -- 2문항: 어려운 (difficulty 5, comparison/roleplay)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty, q.audio_url
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
      'source', 'question',
      'audio_url', v_q.audio_url
    );
    v_question_order := v_question_order + 1;
  END LOOP;

  -- 1문항: 고급 (difficulty 6 또는 5, advanced)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty, q.audio_url
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
      'source', 'question',
      'audio_url', v_q.audio_url
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
