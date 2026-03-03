-- ============================================================================
-- 041_exam_integrity_fixes.sql
-- 시험 기능 데이터 무결성 + 보안 강화 + 시드 데이터 보강
--
-- 수정 내역:
--   C1. 상태 전이 강제 트리거 (completed/abandoned → 재오픈 차단)
--   C2. exam_responses RLS: in_progress 세션만 INSERT/UPDATE 허용
--   C3. 동시 in_progress 세션 방지 (partial unique index)
--   C4. difficulty 5/6 시드 데이터 추가 (레벨 테스트 정상화)
--   C5. 보호 컬럼 확장 (organization_id, self_assessment_level 등)
--   M4. RPC is_active 필터 추가
--   M5. 콤보 쿼리 타입별 1개 보장 (DISTINCT ON)
--   M8. roleplay_scenarios UNIQUE(title_en) + 멱등성
--   M9. 어드민 RLS 추가
-- ============================================================================


-- ============================================================================
-- C1. 상태 전이 강제 트리거
--
-- 허용: in_progress → completed / abandoned
-- 차단: completed / abandoned → 어떤 상태든 (authenticated/anon)
-- bypass: service_role (Edge Function)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_exam_session_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- service_role bypass (Edge Function에서 상태 변경 허용)
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 상태가 변경되지 않으면 통과
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- 완료/포기 상태는 변경 불가 (되돌리기 차단)
  IF OLD.status IN ('completed', 'abandoned') THEN
    RAISE EXCEPTION '완료되거나 포기한 시험의 상태는 변경할 수 없습니다';
  END IF;

  -- in_progress → completed / abandoned만 허용
  IF OLD.status = 'in_progress' AND NEW.status NOT IN ('completed', 'abandoned') THEN
    RAISE EXCEPTION '진행 중인 시험은 완료 또는 포기만 가능합니다';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_exam_session_status_transition_trigger
  BEFORE UPDATE ON public.exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_exam_session_status_transition();

COMMENT ON FUNCTION public.enforce_exam_session_status_transition IS
  'exam_sessions 상태 전이 강제. completed/abandoned 되돌리기 차단.';


-- ============================================================================
-- C2. exam_responses RLS 보강 — in_progress 세션만 수정 허용
--
-- 효과: 채점 완료 후 audio_url/transcription 덮어쓰기 차단
-- Edge Function은 service_role (RLS bypass)이므로 채점 결과 저장 가능
-- ============================================================================

DROP POLICY IF EXISTS "exam_responses_insert" ON public.exam_responses;
CREATE POLICY "exam_responses_insert"
  ON public.exam_responses FOR INSERT
  WITH CHECK (
    exam_session_id IN (
      SELECT es.id FROM public.exam_sessions es
      WHERE es.student_id = auth.uid()
        AND es.deleted_at IS NULL
        AND es.status = 'in_progress'
    )
  );

DROP POLICY IF EXISTS "exam_responses_update" ON public.exam_responses;
CREATE POLICY "exam_responses_update"
  ON public.exam_responses FOR UPDATE
  USING (
    exam_session_id IN (
      SELECT es.id FROM public.exam_sessions es
      WHERE es.student_id = auth.uid()
        AND es.deleted_at IS NULL
        AND es.status = 'in_progress'
    )
  );


-- ============================================================================
-- C3. 동시 in_progress 세션 방지
--
-- TOCTOU 근본 해결: check_exam_availability → INSERT 사이 레이스 컨디션 차단
-- partial unique index: 학생당 최대 1개 in_progress 세션
-- ============================================================================

-- 먼저 stale 세션 정리 (2시간 이상 방치된 in_progress)
UPDATE public.exam_sessions
SET status = 'abandoned', completed_at = now()
WHERE status = 'in_progress'
  AND started_at < now() - interval '2 hours'
  AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_session_in_progress
  ON public.exam_sessions(student_id)
  WHERE status = 'in_progress' AND deleted_at IS NULL;


-- ============================================================================
-- C5. 보호 컬럼 확장
--
-- 기존 039 트리거에 누락된 컬럼 추가:
--   exam_sessions: organization_id, self_assessment_level, survey_topics,
--                  roleplay_scenario_id, started_at, deleted_at
--   exam_responses: combo_number, combo_position
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_exam_session_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER 함수(postgres)에서 호출 = 신뢰된 서버 코드 → bypass
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 점수/등급 컬럼 보호 (서버만 변경 가능)
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

  -- 불변 컬럼 (생성 후 변경 불가)
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'student_id 변경은 허용되지 않습니다';
  END IF;

  IF NEW.exam_type IS DISTINCT FROM OLD.exam_type THEN
    RAISE EXCEPTION 'exam_type 변경은 허용되지 않습니다';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at 변경은 허용되지 않습니다';
  END IF;

  -- 041 추가: 세션 메타데이터 보호 (사후 변조 차단)
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id 변경은 허용되지 않습니다';
  END IF;

  IF NEW.self_assessment_level IS DISTINCT FROM OLD.self_assessment_level THEN
    RAISE EXCEPTION 'self_assessment_level 변경은 허용되지 않습니다';
  END IF;

  IF NEW.survey_topics IS DISTINCT FROM OLD.survey_topics THEN
    RAISE EXCEPTION 'survey_topics 변경은 허용되지 않습니다';
  END IF;

  IF NEW.roleplay_scenario_id IS DISTINCT FROM OLD.roleplay_scenario_id THEN
    RAISE EXCEPTION 'roleplay_scenario_id 변경은 허용되지 않습니다';
  END IF;

  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'started_at 변경은 허용되지 않습니다';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'deleted_at 변경은 허용되지 않습니다';
  END IF;

  RETURN NEW;
END;
$$;

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

  -- 041 추가: 콤보 메타데이터 보호
  IF NEW.combo_number IS DISTINCT FROM OLD.combo_number THEN
    RAISE EXCEPTION 'combo_number 변경은 허용되지 않습니다';
  END IF;

  IF NEW.combo_position IS DISTINCT FROM OLD.combo_position THEN
    RAISE EXCEPTION 'combo_position 변경은 허용되지 않습니다';
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- M8. roleplay_scenarios UNIQUE 제약 (멱등 시드 데이터)
-- ============================================================================

ALTER TABLE public.roleplay_scenarios
  ADD CONSTRAINT roleplay_scenarios_title_en_unique UNIQUE (title_en);


-- ============================================================================
-- M9. 어드민 RLS — super_admin은 비활성 시나리오도 조회 가능
-- ============================================================================

CREATE POLICY "roleplay_scenarios_select_admin"
  ON public.roleplay_scenarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.platform_role = 'super_admin'
    )
  );

CREATE POLICY "roleplay_scenario_questions_select_admin"
  ON public.roleplay_scenario_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.platform_role = 'super_admin'
    )
  );


-- ============================================================================
-- C4. 시드 데이터 보강 — difficulty 5/6 문제 추가
--
-- 레벨 테스트 RPC가 요구하는 문제:
--   difficulty 5 + comparison: 2개
--   difficulty 5 + roleplay:   2개 (기존 question_type enum에 없으면 experience로 대체)
--   difficulty 6 + advanced:   2개
--
-- 모의고사 Q14-Q15 (레벨 5+)가 요구하는 문제:
--   difficulty >= 5 + (advanced | comparison)
-- ============================================================================

-- difficulty 5, comparison (여행/휴가 토픽)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.qtype::public.question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Compare how people traveled in the past with how they travel now. What has changed and what has stayed the same?',
   'comparison', 5, '과거와 현재의 여행 방식을 비교해 보세요. 무엇이 바뀌고 무엇이 그대로인가요?', 20),
  ('Compare the advantages and disadvantages of traveling alone versus traveling with a group. Which do you prefer and why?',
   'comparison', 5, '혼자 여행과 그룹 여행의 장단점을 비교하세요. 어떤 것을 선호하고 왜 그런가요?', 21)
) AS q(question_text, qtype, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Travel/Vacation'
ON CONFLICT DO NOTHING;

-- difficulty 5, comparison (쇼핑 토픽)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.qtype::public.question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Compare the experience of shopping online with shopping at a physical store. How has shopping changed over the years?',
   'comparison', 5, '온라인 쇼핑과 오프라인 매장 쇼핑 경험을 비교하세요. 쇼핑이 어떻게 변해왔나요?', 20),
  ('Compare the shopping habits of younger people and older people in your country. What are the main differences?',
   'comparison', 5, '당신 나라에서 젊은 세대와 나이 든 세대의 쇼핑 습관을 비교하세요.', 21)
) AS q(question_text, qtype, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Shopping'
ON CONFLICT DO NOTHING;

-- difficulty 5, experience (기술/가전 토픽 — roleplay 타입 대신 experience로 대체)
-- 레벨 테스트에서 difficulty 5 + comparison/roleplay 요구하지만,
-- question_type enum에 roleplay가 없으므로 experience를 추가 사용
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.qtype::public.question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a time when a piece of technology failed you at a critical moment. What happened and how did you handle the situation?',
   'experience', 5, '중요한 순간에 기술이 고장 난 경험을 이야기해 주세요. 어떻게 대처했나요?', 10),
  ('Describe an experience where you had to learn to use a completely new technology or device. What challenges did you face?',
   'experience', 5, '완전히 새로운 기술이나 기기를 배워야 했던 경험을 설명하세요.', 11)
) AS q(question_text, qtype, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Technology'
ON CONFLICT DO NOTHING;

-- difficulty 6, advanced (여러 토픽에서 사용 가능한 고급 문제)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.qtype::public.question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Some people argue that technology has made our lives more stressful rather than easier. Do you agree or disagree? Support your opinion with specific examples from your own experience.',
   'advanced', 6, '기술이 삶을 편하게 한 게 아니라 오히려 스트레스를 더했다는 주장에 동의하나요? 구체적 경험으로 뒷받침하세요.', 30)
) AS q(question_text, qtype, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Technology'
ON CONFLICT DO NOTHING;

INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.qtype::public.question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Many countries are experiencing a decline in physical activity among young people. What do you think are the main causes, and what solutions would you propose?',
   'advanced', 6, '많은 나라에서 청소년의 신체 활동이 줄어들고 있습니다. 주요 원인과 해결책을 제안하세요.', 30)
) AS q(question_text, qtype, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Exercise/Fitness'
ON CONFLICT DO NOTHING;

INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.qtype::public.question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you think the way people travel today is sustainable for the environment? What changes should be made to make tourism more responsible?',
   'advanced', 6, '오늘날 사람들의 여행 방식이 환경적으로 지속 가능하다고 생각하나요? 더 책임감 있는 관광을 위해 어떤 변화가 필요한가요?', 31)
) AS q(question_text, qtype, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Travel/Vacation'
ON CONFLICT DO NOTHING;


-- ============================================================================
-- M4 + M5. RPC 함수 수정
--   - is_active 필터 추가
--   - 콤보 쿼리: DISTINCT ON으로 타입별 1개 보장
-- ============================================================================

-- === generate_mock_exam_questions ===
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

  -- 역할 검증
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

  -- 문항 수 결정
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
    AND t.is_active = true
    AND q.is_active = true
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
  -- DISTINCT ON으로 타입별 1개만 선택, 외부에서 순서 보장
  v_topic_id := v_survey_topics[1];
  FOR v_q IN
    SELECT sub.id, sub.question_text, sub.question_type
    FROM (
      SELECT DISTINCT ON (q.question_type)
        q.id, q.question_text, q.question_type
      FROM public.questions q
      WHERE q.topic_id = v_topic_id
        AND q.question_type IN ('describe', 'routine', 'experience')
        AND q.is_active = true
      ORDER BY q.question_type, random()
    ) sub
    ORDER BY
      CASE sub.question_type
        WHEN 'describe' THEN 1
        WHEN 'routine' THEN 2
        WHEN 'experience' THEN 3
      END
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
    SELECT sub.id, sub.question_text, sub.question_type
    FROM (
      SELECT DISTINCT ON (q.question_type)
        q.id, q.question_text, q.question_type
      FROM public.questions q
      WHERE q.topic_id = v_topic_id
        AND q.question_type IN ('describe', 'comparison', 'experience')
        AND q.is_active = true
      ORDER BY q.question_type, random()
    ) sub
    ORDER BY
      CASE sub.question_type
        WHEN 'describe' THEN 1
        WHEN 'comparison' THEN 2
        WHEN 'experience' THEN 3
      END
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
    AND t.is_active = true
    AND t.id != ALL(p_survey_topic_ids)
  ORDER BY random()
  LIMIT 1;

  IF v_unexpected_topic_id IS NOT NULL THEN
    FOR v_q IN
      SELECT sub.id, sub.question_text, sub.question_type
      FROM (
        SELECT DISTINCT ON (q.question_type)
          q.id, q.question_text, q.question_type
        FROM public.questions q
        WHERE q.topic_id = v_unexpected_topic_id
          AND q.question_type IN ('describe', 'routine', 'experience')
          AND q.is_active = true
        ORDER BY q.question_type, random()
      ) sub
      ORDER BY
        CASE sub.question_type
          WHEN 'describe' THEN 1
          WHEN 'routine' THEN 2
          WHEN 'experience' THEN 3
        END
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
          AND q.is_active = true
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
          AND q.is_active = true
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


-- === generate_level_test_questions ===
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

  -- 역할 검증
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
      AND q.is_active = true
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
      AND q.is_active = true
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

  -- 2문항: 어려운 (difficulty 5, comparison/experience)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty
    FROM public.questions q
    WHERE q.difficulty = 5
      AND q.question_type IN ('comparison', 'experience')
      AND q.is_active = true
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

  -- 1문항: 고급 (difficulty >= 5, advanced)
  FOR v_q IN
    SELECT q.id, q.question_text, q.question_type, q.difficulty
    FROM public.questions q
    WHERE q.difficulty >= 5
      AND q.question_type = 'advanced'
      AND q.is_active = true
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
