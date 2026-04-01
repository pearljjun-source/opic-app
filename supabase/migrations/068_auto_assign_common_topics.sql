-- ============================================================================
-- 068: 공통 토픽 자동 배정 (자기소개 + 집/거주 + 이웃/동네)
-- ============================================================================
--
-- 실제 OPIc 시험 구조:
--   - 자기소개: 항상 Q1으로 출제 (선택 불가)
--   - 집/거주, 이웃/동네: Q3 거주 형태 선택 시 자동 출제 (선택 불가)
--
-- 변경:
--   1. 자기소개 토픽 is_active = true 복원 (스크립트 연습용)
--   2. 3개 토픽에 is_auto_assigned = true 마킹
--   3. set_student_topics RPC: 자동 배정 토픽 서버 사이드 추가
--      - 클라이언트가 보내지 않아도 항상 포함
--      - 12개 최소 카운트에서 자동 배정 토픽 제외
-- ============================================================================

-- 1. topics 테이블에 is_auto_assigned 컬럼 추가
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS is_auto_assigned boolean NOT NULL DEFAULT false;

-- 2. 자기소개 토픽: is_active 복원 + 자동 배정 마킹
UPDATE public.topics
SET is_active = true, is_auto_assigned = true
WHERE name_en = 'Self Introduction' AND category = 'survey';

-- 3. 집/거주, 이웃/동네: 자동 배정 마킹
UPDATE public.topics
SET is_auto_assigned = true
WHERE name_en IN ('Home/Housing', 'Neighborhood') AND category = 'survey';

-- 4. set_student_topics RPC 재작성: 자동 배정 토픽 서버 사이드 추가
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
  v_auto_ids uuid[];
  v_all_ids uuid[];
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

  -- 자동 배정 토픽 ID 수집
  SELECT array_agg(id) INTO v_auto_ids
  FROM public.topics
  WHERE is_auto_assigned = true AND is_active = true AND category = 'survey';

  -- 클라이언트가 보낸 ID에서 자동 배정 토픽 제거 (중복 방지)
  -- 그 후 자동 배정 토픽을 합침
  IF v_auto_ids IS NOT NULL THEN
    v_all_ids := (
      SELECT array_agg(DISTINCT id) FROM (
        SELECT unnest(p_topic_ids) AS id
        UNION
        SELECT unnest(v_auto_ids) AS id
      ) sub
    );
  ELSE
    v_all_ids := p_topic_ids;
  END IF;

  -- 검증 1: 모든 topic_id가 active 토픽인지 (survey + unexpected)
  SELECT COUNT(*) INTO v_valid_count
  FROM public.topics
  WHERE id = ANY(v_all_ids) AND is_active = true AND category IN ('survey', 'unexpected');

  IF v_valid_count != array_length(v_all_ids, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOPIC');
  END IF;

  -- 검증 2: 활성 그룹별 선택 규칙 (Q4~Q7만)
  FOR v_group_record IN
    SELECT tg.id, tg.name_ko, tg.selection_type, tg.min_selections
    FROM public.topic_groups tg
    WHERE tg.is_active = true
    ORDER BY tg.sort_order
  LOOP
    SELECT COUNT(*) INTO v_group_selection_count
    FROM public.topics t
    WHERE t.id = ANY(v_all_ids) AND t.group_id = v_group_record.id;

    IF v_group_record.selection_type = 'single' AND v_group_selection_count > 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'SINGLE_GROUP_EXCEEDED',
        'detail', v_group_record.name_ko || '에서는 1개만 선택할 수 있습니다.');
    END IF;

    IF v_group_selection_count < v_group_record.min_selections THEN
      RETURN jsonb_build_object('success', false, 'error', 'GROUP_MIN_NOT_MET',
        'detail', v_group_record.name_ko || '에서 최소 ' || v_group_record.min_selections || '개를 선택해야 합니다.');
    END IF;
  END LOOP;

  -- 검증 3: 서베이 토픽 총 12개 이상 (자동 배정 + 돌발 제외)
  SELECT COUNT(*) INTO v_survey_count
  FROM public.topics
  WHERE id = ANY(v_all_ids)
    AND category = 'survey'
    AND is_auto_assigned = false;

  IF v_survey_count < 12 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MIN_TOTAL_NOT_MET',
      'detail', '최소 12개 이상의 서베이 토픽을 선택해야 합니다. (현재: ' || v_survey_count || '개)');
  END IF;

  -- 기존 배정 hard delete + 새 토픽 배정
  DELETE FROM public.student_topics WHERE student_id = p_student_id;

  FOREACH v_topic_id IN ARRAY v_all_ids
  LOOP
    INSERT INTO public.student_topics (student_id, topic_id)
    VALUES (p_student_id, v_topic_id);
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. 스키마 캐시 리로드
NOTIFY pgrst, 'reload schema';
