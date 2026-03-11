-- ============================================================================
-- 042: admin_get_organization_detail에 조직 정보 추가
--
-- 근본 원인: RPC가 members + subscription만 반환하여, 화면에서 org 정보를 얻기 위해
-- admin_list_organizations() (전체 학원 목록)를 호출 후 .find()로 하나만 사용.
-- N+1이 아닌 "전체 조회 후 1건 사용" 패턴 → 불필요한 전체 테이블 스캔.
--
-- 해결: admin_get_organization_detail에 org-level 정보 포함
-- (name, owner_name, owner_email, created_at, member_count, teacher_count, student_count)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_organization_detail(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_org jsonb;
  v_members jsonb;
  v_subscription jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('error', 'ADMIN_ONLY');
  END IF;

  -- 조직 정보 + 통계
  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'created_at', o.created_at,
    'owner_name', (SELECT u.name FROM public.users u WHERE u.id = o.owner_id),
    'owner_email', (SELECT u.email FROM public.users u WHERE u.id = o.owner_id),
    'member_count', (
      SELECT COUNT(*) FROM public.organization_members om
      WHERE om.organization_id = o.id AND om.deleted_at IS NULL
    ),
    'teacher_count', (
      SELECT COUNT(*) FROM public.organization_members om
      WHERE om.organization_id = o.id AND om.role IN ('owner', 'teacher') AND om.deleted_at IS NULL
    ),
    'student_count', (
      SELECT COUNT(*) FROM public.organization_members om
      WHERE om.organization_id = o.id AND om.role = 'student' AND om.deleted_at IS NULL
    )
  )
  INTO v_org
  FROM public.organizations o
  WHERE o.id = p_org_id AND o.deleted_at IS NULL;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('error', 'ORG_NOT_FOUND');
  END IF;

  -- 멤버 목록 (users JOIN)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', om.id,
      'user_id', om.user_id,
      'name', COALESCE(u.name, '(알 수 없음)'),
      'email', COALESCE(u.email, ''),
      'role', om.role,
      'created_at', om.created_at
    ) ORDER BY om.created_at ASC
  ), '[]'::jsonb)
  INTO v_members
  FROM public.organization_members om
  LEFT JOIN public.users u ON u.id = om.user_id
  WHERE om.organization_id = p_org_id AND om.deleted_at IS NULL;

  -- 활성 구독 (subscription_plans JOIN)
  SELECT jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'plan_name', COALESCE(sp.name, '(알 수 없음)'),
    'plan_key', COALESCE(sp.plan_key, ''),
    'plan_id', s.plan_id,
    'current_period_end', s.current_period_end,
    'cancel_at_period_end', s.cancel_at_period_end,
    'canceled_at', s.canceled_at
  )
  INTO v_subscription
  FROM public.subscriptions s
  LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.organization_id = p_org_id
    AND s.status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  RETURN jsonb_build_object(
    'org', v_org,
    'members', v_members,
    'subscription', v_subscription
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_organization_detail IS 'Super Admin: 학원 상세 (조직 정보 + 멤버 + 구독)';
