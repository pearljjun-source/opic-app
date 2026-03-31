-- ============================================================================
-- 067: OPIc 서베이 프로필 분리 + 토픽 그룹 재구성
--
-- 근본 원인: 065에서 Q1~Q3(직업/학생/거주지)를 topic_groups로 모델링했으나,
-- 실제 OPIc에서는 프로필 질문(단일 선택)이지 토픽이 아님.
-- Q4~Q7(여가/취미/운동/휴가)만이 토픽 선택 영역.
--
-- 변경:
-- 1. student_survey_profiles 테이블 (Q1~Q3 프로필 저장)
-- 2. Q1~Q3 topic_groups 비활성화
-- 3. Q1~Q3용 신규 토픽 비활성화 (065에서 추가된 직업/학생/거주지 옵션)
-- 4. 기존 "집/거주", "이웃/동네" 토픽: 그룹 해제 (ungrouped survey)
-- 5. student_topics 정리 (비활성화된 토픽 제거)
-- 6. save_survey_profile / get_survey_profile RPC
-- 7. getTopicGroups()가 is_active 필터링하도록 보장
-- ============================================================================

-- ============================================================================
-- 1. student_survey_profiles 테이블 (Q1~Q3)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_survey_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Q1: 직업
  job_type text NOT NULL DEFAULT 'none'
    CHECK (job_type IN ('office_worker', 'work_from_home', 'educator', 'none')),
  -- Q2: 학생 여부
  is_student boolean NOT NULL DEFAULT false,
  student_type text
    CHECK (student_type IS NULL OR student_type IN (
      'degree', 'continuing_ed', 'language_class', 'over_5_years'
    )),
  -- Q3: 거주 형태
  residence_type text NOT NULL DEFAULT 'with_family'
    CHECK (residence_type IN ('alone', 'with_roommates', 'with_family', 'dormitory', 'military')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT student_survey_profiles_student_unique UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_survey_profiles_student
  ON public.student_survey_profiles(student_id);

COMMENT ON TABLE public.student_survey_profiles IS 'OPIc Background Survey Q1~Q3 프로필 (직업/학생/거주지)';

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.update_survey_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_survey_profile_updated_at
  BEFORE UPDATE ON public.student_survey_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_survey_profile_updated_at();

-- RLS
ALTER TABLE public.student_survey_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_survey_profiles_select"
  ON public.student_survey_profiles FOR SELECT
  USING (
    auth.uid() = student_id
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.teacher_student ts
      WHERE ts.teacher_id = auth.uid() AND ts.student_id = student_survey_profiles.student_id
        AND ts.deleted_at IS NULL
    )
  );

CREATE POLICY "student_survey_profiles_insert"
  ON public.student_survey_profiles FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "student_survey_profiles_update"
  ON public.student_survey_profiles FOR UPDATE
  USING (auth.uid() = student_id);

-- ============================================================================
-- 2. Q1~Q3 topic_groups 비활성화
-- ============================================================================

UPDATE public.topic_groups SET is_active = false
WHERE name_en IN ('Job/Occupation', 'Student Status', 'Housing Type');

-- ============================================================================
-- 3. Q1~Q3용 신규 토픽 비활성화 (065에서 추가된 프로필 옵션 토픽들)
--    기존 스크립트/질문은 유지되지만 토픽 선택 UI에서 숨겨짐
-- ============================================================================

UPDATE public.topics SET is_active = false, group_id = NULL
WHERE name_en IN (
  -- 직업 그룹 (065 신규)
  'Office Worker', 'Self-Employed', 'Freelancer', 'Public Official', 'Professional',
  -- 학생 그룹 (065 신규)
  'University Student', 'Graduate Student', 'Working Student',
  -- 거주지 그룹 (065 신규)
  'Apartment', 'Studio/Officetel', 'Dormitory'
) AND category = 'survey';

-- ============================================================================
-- 4. "집/거주", "이웃/동네": 그룹 해제 → ungrouped survey 토픽
--    (어떤 거주지를 선택하든 OPIc에서 자동 출제되는 공통 주제)
-- ============================================================================

UPDATE public.topics SET group_id = NULL
WHERE name_en IN ('Home/Housing', 'Neighborhood') AND category = 'survey';

-- ============================================================================
-- 5. student_topics 정리: 비활성화된 토픽 참조 제거
-- ============================================================================

DELETE FROM public.student_topics
WHERE topic_id IN (
  SELECT id FROM public.topics WHERE is_active = false
);

-- ============================================================================
-- 6. save_survey_profile RPC (UPSERT)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_survey_profile(
  p_student_id uuid,
  p_job_type text DEFAULT 'none',
  p_is_student boolean DEFAULT false,
  p_student_type text DEFAULT NULL,
  p_residence_type text DEFAULT 'with_family'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 인가: 본인 또는 연결된 강사 또는 super_admin
  IF v_caller_id != p_student_id
     AND NOT public.is_super_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.teacher_student
       WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
     )
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  -- 학생 아닌 경우 student_type NULL 강제
  IF NOT p_is_student THEN
    p_student_type := NULL;
  END IF;

  -- UPSERT
  INSERT INTO public.student_survey_profiles (
    student_id, job_type, is_student, student_type, residence_type
  ) VALUES (
    p_student_id, p_job_type, p_is_student, p_student_type, p_residence_type
  )
  ON CONFLICT (student_id) DO UPDATE SET
    job_type = EXCLUDED.job_type,
    is_student = EXCLUDED.is_student,
    student_type = EXCLUDED.student_type,
    residence_type = EXCLUDED.residence_type;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.save_survey_profile IS 'OPIc 서베이 프로필 저장 (Q1~Q3: 직업/학생/거주지)';

-- ============================================================================
-- 7. get_survey_profile RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_survey_profile(
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_profile record;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 인가: 본인 또는 연결된 강사 또는 super_admin
  IF v_caller_id != p_student_id
     AND NOT public.is_super_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.teacher_student
       WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
     )
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  SELECT * INTO v_profile
  FROM public.student_survey_profiles
  WHERE student_id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'profile', NULL);
  END IF;

  RETURN jsonb_build_object('success', true, 'profile', jsonb_build_object(
    'job_type', v_profile.job_type,
    'is_student', v_profile.is_student,
    'student_type', v_profile.student_type,
    'residence_type', v_profile.residence_type
  ));
END;
$$;

COMMENT ON FUNCTION public.get_survey_profile IS 'OPIc 서베이 프로필 조회 (Q1~Q3)';

-- ============================================================================
-- 8. set_student_topics: 그룹 미배정 survey 토픽도 허용하도록 검증 수정
--    (집/거주, 이웃/동네는 group_id=NULL인 survey 토픽)
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
  v_caller_id uuid;
  v_topic_id uuid;
  v_valid_count int;
  v_group_record record;
  v_group_selection_count int;
  v_survey_count int;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 인가: 연결된 강사 또는 super_admin 또는 본인(학생)
  IF v_caller_id != p_student_id
     AND NOT public.is_super_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.teacher_student
       WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
     )
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  -- 빈 배열 허용 (토픽 초기화)
  IF p_topic_ids IS NULL OR array_length(p_topic_ids, 1) IS NULL THEN
    DELETE FROM public.student_topics WHERE student_id = p_student_id;
    RETURN jsonb_build_object('success', true);
  END IF;

  -- 검증 1: 모든 topic_id가 active 토픽인지 (survey + unexpected)
  SELECT COUNT(*) INTO v_valid_count
  FROM public.topics
  WHERE id = ANY(p_topic_ids) AND is_active = true AND category IN ('survey', 'unexpected');

  IF v_valid_count != array_length(p_topic_ids, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOPIC');
  END IF;

  -- 검증 2: 활성 그룹별 선택 규칙 (Q4~Q7만, Q1~Q3은 is_active=false)
  FOR v_group_record IN
    SELECT tg.id, tg.name_ko, tg.selection_type, tg.min_selections
    FROM public.topic_groups tg
    WHERE tg.is_active = true
    ORDER BY tg.sort_order
  LOOP
    SELECT COUNT(*) INTO v_group_selection_count
    FROM public.topics t
    WHERE t.id = ANY(p_topic_ids) AND t.group_id = v_group_record.id;

    -- single 그룹에서 2개 이상 선택 차단
    IF v_group_record.selection_type = 'single' AND v_group_selection_count > 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'SINGLE_GROUP_EXCEEDED',
        'detail', v_group_record.name_ko || '에서는 1개만 선택할 수 있습니다.');
    END IF;

    -- 각 그룹 최소 선택 수 검증
    IF v_group_selection_count < v_group_record.min_selections THEN
      RETURN jsonb_build_object('success', false, 'error', 'GROUP_MIN_NOT_MET',
        'detail', v_group_record.name_ko || '에서 최소 ' || v_group_record.min_selections || '개를 선택해야 합니다.');
    END IF;
  END LOOP;

  -- 검증 3: 서베이 토픽 총 12개 이상 (돌발 제외)
  SELECT COUNT(*) INTO v_survey_count
  FROM public.topics
  WHERE id = ANY(p_topic_ids) AND category = 'survey';

  IF v_survey_count < 12 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MIN_TOTAL_NOT_MET',
      'detail', '최소 12개 이상의 서베이 토픽을 선택해야 합니다. (현재: ' || v_survey_count || '개)');
  END IF;

  -- 기존 배정 hard delete
  DELETE FROM public.student_topics WHERE student_id = p_student_id;

  -- 새 토픽 배정
  FOREACH v_topic_id IN ARRAY p_topic_ids
  LOOP
    INSERT INTO public.student_topics (student_id, topic_id)
    VALUES (p_student_id, v_topic_id);
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 9. 스키마 캐시 리로드
-- ============================================================================

NOTIFY pgrst, 'reload schema';
