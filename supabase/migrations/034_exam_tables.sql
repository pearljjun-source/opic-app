-- ============================================================================
-- 034_exam_tables.sql
-- OPIc 모의고사 / 콤보 롤플레이 / 레벨 테스트 테이블
-- ============================================================================

-- ============================================================================
-- 1. roleplay_scenarios — 롤플레이 시나리오 세트
-- ============================================================================

CREATE TABLE public.roleplay_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ko text NOT NULL,
  title_en text NOT NULL,
  description_ko text,
  scenario_context text NOT NULL, -- Ava가 읽어주는 상황 설명
  difficulty int NOT NULL CHECK (difficulty BETWEEN 2 AND 6),
  category text,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 2. roleplay_scenario_questions — 시나리오당 3문항
-- ============================================================================

CREATE TABLE public.roleplay_scenario_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.roleplay_scenarios(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position BETWEEN 1 AND 3),
  question_text text NOT NULL,
  roleplay_type text NOT NULL CHECK (roleplay_type IN ('ask_questions', 'problem_solution', 'related_experience')),
  hint_ko text,
  audio_url text,
  UNIQUE(scenario_id, position)
);

-- ============================================================================
-- 3. exam_sessions — 시험 세션 (모의고사/콤보/레벨테스트 공통)
-- ============================================================================

CREATE TABLE public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  exam_type text NOT NULL CHECK (exam_type IN ('mock_exam', 'combo_roleplay', 'level_test')),
  self_assessment_level int CHECK (self_assessment_level BETWEEN 1 AND 6),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  survey_topics jsonb,
  roleplay_scenario_id uuid REFERENCES public.roleplay_scenarios(id),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  total_duration_sec int,
  -- ACTFL 4차원 점수 (0-100)
  estimated_grade text CHECK (estimated_grade IS NULL OR estimated_grade IN ('NL','NM','NH','IL','IM1','IM2','IM3','IH','AL')),
  score_function int CHECK (score_function IS NULL OR score_function BETWEEN 0 AND 100),
  score_accuracy int CHECK (score_accuracy IS NULL OR score_accuracy BETWEEN 0 AND 100),
  score_content int CHECK (score_content IS NULL OR score_content BETWEEN 0 AND 100),
  score_text_type int CHECK (score_text_type IS NULL OR score_text_type BETWEEN 0 AND 100),
  overall_score int CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 100),
  evaluation_report jsonb,
  processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- ============================================================================
-- 4. exam_responses — 개별 문항 응답
-- ============================================================================

CREATE TABLE public.exam_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id),
  roleplay_question_id uuid REFERENCES public.roleplay_scenario_questions(id),
  question_order int NOT NULL CHECK (question_order > 0),
  combo_number int CHECK (combo_number IS NULL OR combo_number BETWEEN 1 AND 5),
  combo_position int CHECK (combo_position IS NULL OR combo_position BETWEEN 1 AND 3),
  audio_url text,
  duration_sec int CHECK (duration_sec IS NULL OR duration_sec >= 0),
  transcription text,
  score int CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  feedback jsonb,
  processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  is_scored boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  -- 데이터 무결성: question_id와 roleplay_question_id 중 정확히 하나만 설정
  CONSTRAINT exactly_one_question CHECK (
    (question_id IS NOT NULL AND roleplay_question_id IS NULL) OR
    (question_id IS NULL AND roleplay_question_id IS NOT NULL)
  ),
  -- 세션 내 문항 순서 중복 방지
  UNIQUE(exam_session_id, question_order)
);

-- ============================================================================
-- 5. 인덱스
-- ============================================================================

CREATE INDEX idx_exam_sessions_student ON public.exam_sessions(student_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_exam_sessions_org ON public.exam_sessions(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_exam_sessions_type ON public.exam_sessions(exam_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_exam_responses_session ON public.exam_responses(exam_session_id, question_order);

-- ============================================================================
-- 6. RLS 활성화
-- ============================================================================

ALTER TABLE public.roleplay_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleplay_scenario_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_responses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. RLS 정책 — roleplay_scenarios (공개 읽기)
-- ============================================================================

CREATE POLICY "roleplay_scenarios_select_active"
  ON public.roleplay_scenarios FOR SELECT
  USING (is_active = true);

CREATE POLICY "roleplay_scenario_questions_select"
  ON public.roleplay_scenario_questions FOR SELECT
  USING (true);

-- ============================================================================
-- 8. RLS 정책 — exam_sessions
-- ============================================================================

-- 학생 본인 SELECT
CREATE POLICY "exam_sessions_select_own"
  ON public.exam_sessions FOR SELECT
  USING (auth.uid() = student_id AND deleted_at IS NULL);

-- 연결된 강사 SELECT (teacher_student 관계 검증)
CREATE POLICY "exam_sessions_select_teacher"
  ON public.exam_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_student ts
      WHERE ts.teacher_id = auth.uid()
        AND ts.student_id = exam_sessions.student_id
        AND ts.deleted_at IS NULL
    ) AND deleted_at IS NULL
  );

-- 학생 본인 INSERT
CREATE POLICY "exam_sessions_insert_own"
  ON public.exam_sessions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- 학생 본인 UPDATE (점수 기록은 Edge Function이 service role로 처리)
CREATE POLICY "exam_sessions_update_own"
  ON public.exam_sessions FOR UPDATE
  USING (auth.uid() = student_id AND deleted_at IS NULL);

-- ============================================================================
-- 9. RLS 정책 — exam_responses
-- ============================================================================

-- SELECT: 세션 소유 학생 또는 연결된 강사
CREATE POLICY "exam_responses_select"
  ON public.exam_responses FOR SELECT
  USING (
    exam_session_id IN (
      SELECT es.id FROM public.exam_sessions es
      WHERE es.deleted_at IS NULL AND (
        es.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.teacher_student ts
          WHERE ts.teacher_id = auth.uid()
            AND ts.student_id = es.student_id
            AND ts.deleted_at IS NULL
        )
      )
    )
  );

-- INSERT: 세션 소유 학생만
CREATE POLICY "exam_responses_insert"
  ON public.exam_responses FOR INSERT
  WITH CHECK (
    exam_session_id IN (
      SELECT es.id FROM public.exam_sessions es
      WHERE es.student_id = auth.uid() AND es.deleted_at IS NULL
    )
  );

-- UPDATE: 세션 소유 학생만 (음성 URL, 전사 텍스트 저장용)
CREATE POLICY "exam_responses_update"
  ON public.exam_responses FOR UPDATE
  USING (
    exam_session_id IN (
      SELECT es.id FROM public.exam_sessions es
      WHERE es.student_id = auth.uid() AND es.deleted_at IS NULL
    )
  );
