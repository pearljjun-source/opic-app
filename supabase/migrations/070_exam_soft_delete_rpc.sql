-- ============================================================================
-- 070: 시험 세션 소프트 삭제 RPC (강사/원장 전용)
-- ============================================================================
-- 강사: 연결된 학생의 시험만 삭제 가능
-- 원장: 같은 조직 학생의 시험 삭제 가능
-- 학생: 삭제 불가 (학습 데이터 보호)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_exam_sessions(
  p_session_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_deleted_count integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 강사/원장 여부 확인 (teacher 또는 owner)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = v_user_id
      AND om.role IN ('teacher', 'owner')
      AND om.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  -- soft delete: 본인이 강사로 연결된 학생의 세션만 (또는 같은 조직 원장)
  UPDATE public.exam_sessions es
  SET deleted_at = NOW()
  WHERE es.id = ANY(p_session_ids)
    AND es.deleted_at IS NULL
    AND (
      -- 강사: 연결된 학생의 시험
      EXISTS (
        SELECT 1 FROM public.teacher_student ts
        WHERE ts.teacher_id = v_user_id
          AND ts.student_id = es.student_id
          AND ts.deleted_at IS NULL
      )
      OR
      -- 원장: 같은 조직의 시험
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = v_user_id
          AND om.role = 'owner'
          AND om.organization_id = es.organization_id
          AND om.deleted_at IS NULL
      )
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count
  );
END;
$$;
