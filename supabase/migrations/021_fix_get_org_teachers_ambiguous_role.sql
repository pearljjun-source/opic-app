-- ============================================================================
-- 021: get_org_teachers — role 컬럼 참조 모호성 수정
-- ============================================================================
-- 원인: RETURNS TABLE에 선언된 `role` 출력 컬럼과
--       organization_members 테이블의 `role` 컬럼이 동일 이름
--       → PL/pgSQL에서 "column reference 'role' is ambiguous" (42702)
-- 해결: 테이블 alias(om)로 컬럼 참조를 명시적으로 한정
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_org_teachers(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  role public.org_role,
  created_at timestamptz,
  students_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- owner만 강사 목록 조회 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = v_user_id
      AND om.role = 'owner' AND om.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    om.role,
    om.created_at,
    (SELECT COUNT(*) FROM public.teacher_student ts
     WHERE ts.teacher_id = u.id
       AND ts.organization_id = p_org_id
       AND ts.deleted_at IS NULL) AS students_count
  FROM public.organization_members om
  JOIN public.users u ON u.id = om.user_id AND u.deleted_at IS NULL
  WHERE om.organization_id = p_org_id
    AND om.role IN ('owner', 'teacher')
    AND om.deleted_at IS NULL
  ORDER BY om.role ASC, u.name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_org_teachers IS 'Owner: 조직 내 강사/원장 목록 (학생 수 포함)';
