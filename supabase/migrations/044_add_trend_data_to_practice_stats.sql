-- ============================================================================
-- 044: get_student_practice_stats에 트렌드 데이터 추가
--
-- 현재 상태: UI(CompactStatsStrip, LearningStatsCard)에서 prev_avg_score,
--           prev_avg_reproduction_rate를 사용하지만 RPC가 반환하지 않음
--
-- 해결: 7~14일 전 연습 데이터로 이전주 평균 계산 추가
--       + target_opic_grade (강사 설정 목표 등급) 반환
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_practice_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_student_practice_stats(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_teacher boolean;
  v_result jsonb;
  v_target_grade text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 본인이면 바로 통과
  IF v_caller_id = p_student_id THEN
    NULL;
  ELSE
    -- 연결된 강사 또는 super_admin만 허용
    v_is_teacher := EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id
        AND student_id = p_student_id
        AND deleted_at IS NULL
    );

    IF NOT v_is_teacher AND NOT public.is_super_admin() THEN
      RETURN jsonb_build_object('error', 'UNAUTHORIZED');
    END IF;
  END IF;

  -- 목표 등급 조회 (강사가 설정한 값)
  SELECT ts.target_opic_grade INTO v_target_grade
  FROM public.teacher_student ts
  WHERE ts.student_id = p_student_id
    AND ts.deleted_at IS NULL
  LIMIT 1;

  -- 통계 + 트렌드 데이터
  SELECT jsonb_build_object(
    'total_practices', COUNT(*),
    'total_duration_minutes', COALESCE(SUM(p.duration) / 60, 0),
    'avg_score', COALESCE(ROUND(AVG(p.score)::numeric, 1), 0),
    'avg_reproduction_rate', COALESCE(ROUND(AVG(p.reproduction_rate)::numeric, 1), 0),
    'this_week_practices', COUNT(*) FILTER (WHERE p.created_at > now() - interval '7 days'),
    'last_practice_at', MAX(p.created_at),
    'prev_avg_score', (
      SELECT COALESCE(ROUND(AVG(p2.score)::numeric, 1), null)
      FROM public.practices p2
      WHERE p2.student_id = p_student_id
        AND p2.deleted_at IS NULL
        AND p2.created_at > now() - interval '14 days'
        AND p2.created_at <= now() - interval '7 days'
    ),
    'prev_avg_reproduction_rate', (
      SELECT COALESCE(ROUND(AVG(p2.reproduction_rate)::numeric, 1), null)
      FROM public.practices p2
      WHERE p2.student_id = p_student_id
        AND p2.deleted_at IS NULL
        AND p2.created_at > now() - interval '14 days'
        AND p2.created_at <= now() - interval '7 days'
    ),
    'target_opic_grade', v_target_grade
  ) INTO v_result
  FROM public.practices p
  WHERE p.student_id = p_student_id
    AND p.deleted_at IS NULL;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_student_practice_stats IS
  '학생 연습 통계 + 트렌드 (본인/연결 강사/super_admin — prev_avg 7~14일 전)';
