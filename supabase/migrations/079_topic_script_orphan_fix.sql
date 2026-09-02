-- ============================================================================
-- 079: 토픽 배정 해제로 인한 스크립트 고아(orphan) 문제 해결
--
-- 근본 원인:
--   set_student_topics는 기존 배정을 hard delete 후 재삽입한다.
--   학생이 서베이를 다시 하거나 강사가 토픽을 재배정하면 이전 배정이 사라지는데,
--   학생이 스크립트에 접근하는 유일한 경로가 "대시보드 → 내 토픽 → 질문 → 스크립트"라서
--   스크립트가 DB에 남아있어도 화면에서 영구히 도달 불가능해진다.
--
-- 해결 (조회 시 병합):
--   get_student_topics_with_progress가 "배정된 토픽 ∪ 스크립트가 있는 토픽"을 반환.
--   is_assigned 플래그로 구분하여 클라이언트가 "스크립트 보관" 뱃지를 표시한다.
--   → 이미 배정이 삭제된 기존 학생들도 배포 즉시 자동 복구된다.
--
-- 설계 근거:
--   - student_topics는 서베이 답변(진실)이므로 그대로 유지 — 임의 보존하지 않는다.
--   - 모의고사 문제 생성(generate_mock_exam_questions)은 p_survey_topic_ids를
--     파라미터로 받으므로 student_topics와 무관 → 시험 로직에 영향 없음.
--   - 비활성(is_active = false) 토픽도 스크립트가 있으면 노출한다.
--     (토픽 비활성화로 인한 동일 유형의 유실 차단)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_topics_with_progress(uuid);

CREATE OR REPLACE FUNCTION public.get_student_topics_with_progress(p_student_id uuid)
RETURNS TABLE (
  topic_id uuid,
  topic_name_ko text,
  topic_name_en text,
  topic_icon text,
  topic_sort_order integer,
  topic_category text,
  topic_group_id uuid,
  topic_group_name_ko text,
  topic_group_sort_order integer,
  total_questions bigint,
  scripts_count bigint,
  practices_count bigint,
  best_avg_score numeric,
  last_practice_at timestamptz,
  is_assigned boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RETURN; END IF;

  v_is_authorized := (v_caller_id = p_student_id)
    OR EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
    )
    OR public.is_super_admin();

  IF NOT v_is_authorized THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    t.id AS topic_id,
    t.name_ko AS topic_name_ko,
    t.name_en AS topic_name_en,
    t.icon AS topic_icon,
    t.sort_order AS topic_sort_order,
    t.category AS topic_category,
    t.group_id AS topic_group_id,
    tg.name_ko AS topic_group_name_ko,
    COALESCE(tg.sort_order, 99) AS topic_group_sort_order,
    (SELECT COUNT(*) FROM public.questions q WHERE q.topic_id = t.id AND q.is_active = true) AS total_questions,
    (SELECT COUNT(*) FROM public.scripts s
     JOIN public.questions q2 ON q2.id = s.question_id
     WHERE s.student_id = p_student_id AND q2.topic_id = t.id
       AND s.deleted_at IS NULL AND s.status = 'complete') AS scripts_count,
    (SELECT COUNT(*) FROM public.practices p
     JOIN public.scripts s2 ON s2.id = p.script_id
     JOIN public.questions q3 ON q3.id = s2.question_id
     WHERE p.student_id = p_student_id AND q3.topic_id = t.id
       AND p.deleted_at IS NULL AND s2.deleted_at IS NULL) AS practices_count,
    (SELECT ROUND(AVG(p2.score)::numeric, 1) FROM public.practices p2
     JOIN public.scripts s3 ON s3.id = p2.script_id
     JOIN public.questions q4 ON q4.id = s3.question_id
     WHERE p2.student_id = p_student_id AND q4.topic_id = t.id
       AND p2.deleted_at IS NULL AND s3.deleted_at IS NULL
       AND p2.score IS NOT NULL) AS best_avg_score,
    (SELECT MAX(p3.created_at) FROM public.practices p3
     JOIN public.scripts s4 ON s4.id = p3.script_id
     JOIN public.questions q5 ON q5.id = s4.question_id
     WHERE p3.student_id = p_student_id AND q5.topic_id = t.id
       AND p3.deleted_at IS NULL AND s4.deleted_at IS NULL) AS last_practice_at,
    (st.student_id IS NOT NULL) AS is_assigned
  FROM public.topics t
  LEFT JOIN public.student_topics st ON st.topic_id = t.id AND st.student_id = p_student_id
  LEFT JOIN public.topic_groups tg ON tg.id = t.group_id
  WHERE
    -- 현재 배정된 활성 토픽
    (st.student_id IS NOT NULL AND t.is_active = true)
    -- 또는 배정이 풀렸더라도 스크립트가 남아있는 토픽 (접근 경로 보존)
    OR EXISTS (
      SELECT 1 FROM public.scripts s5
      JOIN public.questions q6 ON q6.id = s5.question_id
      WHERE s5.student_id = p_student_id AND q6.topic_id = t.id
        AND s5.deleted_at IS NULL AND s5.status = 'complete'
    )
  -- 배정된 토픽 먼저, 그 다음 보관된 토픽
  ORDER BY (st.student_id IS NULL), COALESCE(tg.sort_order, 99), t.sort_order;
END;
$$;

COMMENT ON FUNCTION public.get_student_topics_with_progress IS
  '학생 토픽별 진도 (배정 토픽 ∪ 스크립트 보유 토픽, is_assigned로 구분)';

-- ============================================================================
-- 토픽별 스크립트 보유 현황 조회 (배정 해제 경고 UI용)
-- 강사/학생이 토픽 선택을 해제하기 전에 "이 토픽에 스크립트 N개 있음"을 알리는 데 사용
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_topic_script_counts(p_student_id uuid)
RETURNS TABLE (
  topic_id uuid,
  scripts_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RETURN; END IF;

  IF NOT (
    v_caller_id = p_student_id
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT q.topic_id, COUNT(*) AS scripts_count
  FROM public.scripts s
  JOIN public.questions q ON q.id = s.question_id
  WHERE s.student_id = p_student_id
    AND s.deleted_at IS NULL
    AND s.status = 'complete'
  GROUP BY q.topic_id;
END;
$$;

COMMENT ON FUNCTION public.get_student_topic_script_counts IS
  '학생의 토픽별 스크립트 개수 (토픽 배정 해제 전 경고용)';

-- 스키마 캐시 리로드
NOTIFY pgrst, 'reload schema';
