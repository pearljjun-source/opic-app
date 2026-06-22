-- ============================================================================
-- 077: 약점 토픽/질문 유형 추천
--
-- 변경 내용:
-- 1. NEW RPC: get_weak_areas (약점 토픽 + 질문 유형 분석)
--
-- 보안:
-- - auth.uid() 검증 (본인 데이터만)
-- - STABLE + SECURITY DEFINER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_weak_areas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_weak_topics jsonb;
  v_weak_types jsonb;
  v_unpracticed_topics jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 1. 약점 토픽: 연습한 토픽 중 평균 점수가 낮은 상위 3개
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_weak_topics
  FROM (
    SELECT
      tp.name_ko AS topic_name_ko,
      tp.name_en AS topic_name_en,
      tp.id AS topic_id,
      ROUND(AVG(p.score)::numeric, 1) AS avg_score,
      COUNT(p.id)::int AS practice_count,
      MAX(p.created_at) AS last_practice_at
    FROM public.practices p
    JOIN public.scripts s ON s.id = p.script_id AND s.deleted_at IS NULL
    JOIN public.questions q ON q.id = s.question_id
    JOIN public.topics tp ON tp.id = q.topic_id
    WHERE p.student_id = v_user_id
      AND p.deleted_at IS NULL
      AND p.score IS NOT NULL
    GROUP BY tp.id, tp.name_ko, tp.name_en
    HAVING COUNT(p.id) >= 1
    ORDER BY AVG(p.score) ASC
    LIMIT 3
  ) t;

  -- 2. 약점 질문 유형: 유형별 평균 점수
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_weak_types
  FROM (
    SELECT
      q.question_type::text AS question_type,
      ROUND(AVG(p.score)::numeric, 1) AS avg_score,
      COUNT(p.id)::int AS practice_count
    FROM public.practices p
    JOIN public.scripts s ON s.id = p.script_id AND s.deleted_at IS NULL
    JOIN public.questions q ON q.id = s.question_id
    WHERE p.student_id = v_user_id
      AND p.deleted_at IS NULL
      AND p.score IS NOT NULL
    GROUP BY q.question_type
    HAVING COUNT(p.id) >= 1
    ORDER BY AVG(p.score) ASC
  ) t;

  -- 3. 미연습 토픽: 배정되었지만 연습 기록 0인 토픽
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_unpracticed_topics
  FROM (
    SELECT
      tp.id AS topic_id,
      tp.name_ko AS topic_name_ko,
      tp.name_en AS topic_name_en
    FROM public.student_topics st
    JOIN public.topics tp ON tp.id = st.topic_id
    WHERE st.student_id = v_user_id
      AND st.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.practices p
        JOIN public.scripts s ON s.id = p.script_id AND s.deleted_at IS NULL
        JOIN public.questions q ON q.id = s.question_id AND q.topic_id = tp.id
        WHERE p.student_id = v_user_id
          AND p.deleted_at IS NULL
      )
    ORDER BY tp.sort_order
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'weak_topics', v_weak_topics,
    'weak_question_types', v_weak_types,
    'unpracticed_topics', v_unpracticed_topics
  );
END;
$$;

COMMENT ON FUNCTION public.get_weak_areas IS '학생의 약점 토픽/질문 유형 분석 (본인만 조회)';
