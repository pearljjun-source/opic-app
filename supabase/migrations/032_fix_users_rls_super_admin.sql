-- 032: users 테이블 RLS super_admin bypass + admin_get_user_by_id RPC
--
-- 근본 원인: 024에서 admin RPC 함수들은 is_super_admin() 체크로 수정했지만,
-- users 테이블의 SELECT RLS 정책은 누락. super_admin이 다른 사용자 프로필 조회 불가.
-- 이로 인해: (1) 사용자 상세 "알수없는 오류" (2) 학원 상세 users JOIN 실패 "서버 오류"

-- ================================================================
-- Part 1: users SELECT 정책에 is_super_admin() bypass 추가
-- ================================================================

DROP POLICY IF EXISTS "users_select_own_and_connected" ON public.users;

CREATE POLICY "users_select_own_and_connected" ON public.users
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      -- 슈퍼 어드민: 모든 사용자 조회 가능
      public.is_super_admin()
      -- 본인 프로필
      OR auth.uid() = id
      -- 레거시: 강사-학생 연결
      OR EXISTS (
        SELECT 1 FROM public.teacher_student ts
        WHERE ts.deleted_at IS NULL
          AND ((ts.teacher_id = auth.uid() AND ts.student_id = users.id)
               OR (ts.student_id = auth.uid() AND ts.teacher_id = users.id))
      )
      -- 조직: 같은 조직의 owner/admin이 조직원 조회 가능
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.deleted_at IS NULL
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
          AND om.organization_id IN (
            SELECT om2.organization_id FROM public.organization_members om2
            WHERE om2.user_id = users.id AND om2.deleted_at IS NULL
          )
      )
    )
  );


-- ================================================================
-- Part 2: admin_get_user_by_id RPC — effective_role + 소속 조직 포함
-- ================================================================

CREATE OR REPLACE FUNCTION public.admin_get_user_by_id(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN');
  END IF;

  SELECT jsonb_build_object(
    'id', u.id,
    'name', u.name,
    'email', u.email,
    'role', u.role,
    'platform_role', u.platform_role,
    'effective_role', CASE
      WHEN u.platform_role = 'super_admin' THEN 'super_admin'
      WHEN EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = u.id AND om.role IN ('owner', 'admin') AND om.deleted_at IS NULL
      ) THEN 'admin'
      WHEN u.role = 'teacher' THEN 'teacher'
      ELSE 'student'
    END,
    'created_at', u.created_at,
    'organizations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'org_id', o.id,
        'org_name', o.name,
        'org_role', om.role
      ))
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = u.id AND om.deleted_at IS NULL AND o.deleted_at IS NULL
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.users u
  WHERE u.id = p_user_id AND u.deleted_at IS NULL;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'USER_NOT_FOUND');
  END IF;

  RETURN v_result;
END;
$$;
