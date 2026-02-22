-- ============================================================================
-- 033: admin_get_organization_detail + admin_get_org_payments RPCs
--
-- 근본 원인: getOrganizationDetail()이 direct query(RLS 의존)로 구현되어 있어
-- users/subscriptions/subscription_plans/payment_history 테이블의 RLS 정책에
-- 의존. super_admin RLS bypass가 제대로 동작하지 않으면 "서버 오류" 발생.
--
-- 해결: SECURITY DEFINER RPC로 전환 (다른 admin 함수들과 동일 패턴)
-- - RLS bypass (SECURITY DEFINER → postgres 역할)
-- - 단일 DB roundtrip (기존 Promise.all 2~3개 → 1개)
-- - is_super_admin() 검증 포함
-- ============================================================================

-- ============================================================================
-- 1. admin_get_organization_detail RPC
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
  v_org record;
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

  -- 조직 존재 확인
  SELECT id INTO v_org
  FROM public.organizations
  WHERE id = p_org_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
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
    'members', v_members,
    'subscription', v_subscription
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_organization_detail IS 'Super Admin: 학원 상세 (멤버 + 구독)';

-- ============================================================================
-- 2. admin_get_org_payments RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_org_payments(
  p_org_id uuid,
  p_limit int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_payments jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('error', 'ADMIN_ONLY');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ph.id,
      'subscription_id', ph.subscription_id,
      'user_id', ph.user_id,
      'amount', ph.amount,
      'currency', ph.currency,
      'status', ph.status,
      'provider_payment_id', ph.provider_payment_id,
      'payment_method', ph.payment_method,
      'card_last4', ph.card_last4,
      'receipt_url', ph.receipt_url,
      'paid_at', ph.paid_at,
      'failed_at', ph.failed_at,
      'failure_reason', ph.failure_reason,
      'created_at', ph.created_at
    ) ORDER BY ph.created_at DESC
  ), '[]'::jsonb)
  INTO v_payments
  FROM public.payment_history ph
  JOIN public.subscriptions s ON s.id = ph.subscription_id
  WHERE s.organization_id = p_org_id
  LIMIT p_limit;

  RETURN jsonb_build_object('payments', v_payments);
END;
$$;

COMMENT ON FUNCTION public.admin_get_org_payments IS 'Super Admin: 학원 결제 이력';
