-- ============================================================================
-- 066: set_student_topics RPC 수정 — 돌발 토픽 허용
--
-- 근본 원인: 065에서 검증 1이 category='survey'만 허용하여
-- unexpected 토픽 포함 시 INVALID_TOPIC 에러 발생.
-- UI에서는 showUnexpected=true로 돌발 토픽 선택 가능.
--
-- 수정:
-- 1. 검증 1: category IN ('survey','unexpected') 허용
-- 2. 그룹별 검증: 서베이 토픽만 대상 (돌발은 그룹 없음)
-- 3. 총 12개 검증: 서베이 토픽만 카운트
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

  -- 검증 1: 모든 topic_id가 active 토픽인지 (survey + unexpected 허용)
  SELECT COUNT(*) INTO v_valid_count
  FROM public.topics
  WHERE id = ANY(p_topic_ids) AND is_active = true AND category IN ('survey', 'unexpected');

  IF v_valid_count != array_length(p_topic_ids, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOPIC');
  END IF;

  -- 검증 2: 그룹별 선택 규칙 (서베이 토픽만 대상)
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

  -- 검증 3: 서베이 토픽 총 12개 이상 (돌발은 제외)
  SELECT COUNT(*) INTO v_survey_count
  FROM public.topics
  WHERE id = ANY(p_topic_ids) AND category = 'survey';

  IF v_survey_count < 12 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MIN_TOTAL_NOT_MET',
      'detail', '최소 12개 이상의 서베이 토픽을 선택해야 합니다. (현재: ' || v_survey_count || '개)');
  END IF;

  -- 기존 배정 hard delete (junction 테이블)
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

COMMENT ON FUNCTION public.set_student_topics IS '토픽 배정 (OPIc 서베이 선택 규칙 서버 검증 + 돌발 토픽 허용)';
