-- ============================================================================
-- 028: admin_list_users — 3계층 역할 시스템 통합
--
-- 근본 원인: admin_list_users가 레거시 users.role만 조회하여
-- platform_role(super_admin), organization_members.role(owner) 미반영
--
-- 수정:
-- 1. effective_role 계산: platform_role > org_role > users.role 우선순위
-- 2. 필터가 effective_role 기준으로 동작
-- 3. org_name 포함 (소속 조직 표시)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_role text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_users jsonb;
  v_total int;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- CTE: effective_role 계산 (platform_role > org_role > users.role)
  -- super_admin > owner > teacher > student 우선순위
  WITH user_effective AS (
    SELECT
      u.id,
      u.email,
      u.name,
      u.role AS legacy_role,
      u.platform_role,
      u.created_at,
      u.push_token,
      -- 조직 역할 (가장 높은 권한)
      (
        SELECT om.role::text
        FROM public.organization_members om
        WHERE om.user_id = u.id AND om.deleted_at IS NULL
        ORDER BY
          CASE om.role
            WHEN 'owner' THEN 1
            WHEN 'teacher' THEN 2
            WHEN 'student' THEN 3
          END
        LIMIT 1
      ) AS org_role,
      -- 조직 이름
      (
        SELECT o.name
        FROM public.organization_members om
        JOIN public.organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
        WHERE om.user_id = u.id AND om.deleted_at IS NULL
        ORDER BY
          CASE om.role
            WHEN 'owner' THEN 1
            WHEN 'teacher' THEN 2
            WHEN 'student' THEN 3
          END
        LIMIT 1
      ) AS org_name,
      -- effective_role: platform_role > org_role > legacy_role
      CASE
        WHEN u.platform_role = 'super_admin' THEN 'super_admin'
        WHEN EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.user_id = u.id AND om.role = 'owner' AND om.deleted_at IS NULL
        ) THEN 'owner'
        WHEN EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.user_id = u.id AND om.role = 'teacher' AND om.deleted_at IS NULL
        ) THEN 'teacher'
        WHEN u.role = 'teacher' THEN 'teacher'
        ELSE 'student'
      END AS effective_role
    FROM public.users u
    WHERE u.deleted_at IS NULL
  )
  -- 전체 카운트
  SELECT COUNT(*) INTO v_total
  FROM user_effective ue
  WHERE (p_role IS NULL OR ue.effective_role = p_role)
    AND (p_search IS NULL OR ue.name ILIKE '%' || p_search || '%' OR ue.email ILIKE '%' || p_search || '%');

  -- 사용자 목록 + 구독 정보
  WITH user_effective AS (
    SELECT
      u.id,
      u.email,
      u.name,
      u.role AS legacy_role,
      u.platform_role,
      u.created_at,
      u.push_token,
      (
        SELECT om.role::text
        FROM public.organization_members om
        WHERE om.user_id = u.id AND om.deleted_at IS NULL
        ORDER BY
          CASE om.role
            WHEN 'owner' THEN 1
            WHEN 'teacher' THEN 2
            WHEN 'student' THEN 3
          END
        LIMIT 1
      ) AS org_role,
      (
        SELECT o.name
        FROM public.organization_members om
        JOIN public.organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
        WHERE om.user_id = u.id AND om.deleted_at IS NULL
        ORDER BY
          CASE om.role
            WHEN 'owner' THEN 1
            WHEN 'teacher' THEN 2
            WHEN 'student' THEN 3
          END
        LIMIT 1
      ) AS org_name,
      CASE
        WHEN u.platform_role = 'super_admin' THEN 'super_admin'
        WHEN EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.user_id = u.id AND om.role = 'owner' AND om.deleted_at IS NULL
        ) THEN 'owner'
        WHEN EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.user_id = u.id AND om.role = 'teacher' AND om.deleted_at IS NULL
        ) THEN 'teacher'
        WHEN u.role = 'teacher' THEN 'teacher'
        ELSE 'student'
      END AS effective_role
    FROM public.users u
    WHERE u.deleted_at IS NULL
  )
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_users
  FROM (
    SELECT jsonb_build_object(
      'id', ue.id,
      'email', ue.email,
      'name', ue.name,
      'role', ue.effective_role,
      'org_role', ue.org_role,
      'org_name', ue.org_name,
      'created_at', ue.created_at,
      'push_token', CASE WHEN ue.push_token IS NOT NULL THEN true ELSE false END,
      'subscription_plan', sp.name,
      'subscription_status', s.status
    ) AS row_data
    FROM user_effective ue
    LEFT JOIN public.subscriptions s
      ON (s.user_id = ue.id OR s.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.user_id = ue.id AND om.deleted_at IS NULL
      ))
      AND s.status IN ('active', 'trialing', 'past_due')
    LEFT JOIN public.subscription_plans sp
      ON sp.id = s.plan_id
    WHERE (p_role IS NULL OR ue.effective_role = p_role)
      AND (p_search IS NULL OR ue.name ILIKE '%' || p_search || '%' OR ue.email ILIKE '%' || p_search || '%')
    ORDER BY ue.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object('success', true, 'users', v_users, 'total', v_total);
END;
$$;
