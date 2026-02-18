-- ============================================================================
-- 027: Admin RPC 수정 + 누락 인덱스
--
-- 수정 사항:
-- 1. admin_list_users: subscription 정보 LEFT JOIN 추가
-- 2. 누락된 성능 인덱스 추가
-- ============================================================================

-- ============================================================================
-- 1. admin_list_users — 구독 정보 포함
-- ============================================================================
-- 기존: id, email, name, role, created_at, push_token만 반환
-- 수정: subscription_plan, subscription_status 추가 (LEFT JOIN)

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

  -- 전체 카운트
  SELECT COUNT(*) INTO v_total
  FROM public.users u
  WHERE u.deleted_at IS NULL
    AND (p_role IS NULL OR u.role::text = p_role)
    AND (p_search IS NULL OR u.name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%');

  -- 사용자 목록 + 구독 정보
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_users
  FROM (
    SELECT jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'name', u.name,
      'role', u.role,
      'created_at', u.created_at,
      'push_token', CASE WHEN u.push_token IS NOT NULL THEN true ELSE false END,
      'subscription_plan', sp.name,
      'subscription_status', s.status
    ) AS row_data
    FROM public.users u
    LEFT JOIN public.subscriptions s
      ON s.user_id = u.id AND s.status IN ('active', 'trialing', 'past_due')
    LEFT JOIN public.subscription_plans sp
      ON sp.id = s.plan_id
    WHERE u.deleted_at IS NULL
      AND (p_role IS NULL OR u.role::text = p_role)
      AND (p_search IS NULL OR u.name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%')
    ORDER BY u.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object('success', true, 'users', v_users, 'total', v_total);
END;
$$;

-- ============================================================================
-- 2. 누락된 성능 인덱스
-- ============================================================================

-- subscriptions: organization_id 일반 조회용 (기존 uq_org_subscription_active는 active만 커버)
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_general
  ON public.subscriptions(organization_id)
  WHERE organization_id IS NOT NULL;

-- subscriptions: user_id + status (admin_list_users LEFT JOIN 최적화)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions(user_id, status);
