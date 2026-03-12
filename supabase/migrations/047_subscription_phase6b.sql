-- ============================================================================
-- 047: Phase 6B — Dunning 알림 + 취소 리텐션
-- ============================================================================
-- 1. subscriptions: dunning_started_at 컬럼 추가
-- 2. cancellation_feedback 테이블 생성
-- 3. notification_logs: 새 알림 타입 허용 (dunning 관련)
-- ============================================================================

-- 1. dunning 시작 시점 추적 (daysSinceEnd 계산 대체)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS dunning_started_at timestamptz;

-- 2. 취소 사유 + 리텐션 제안 기록
CREATE TABLE IF NOT EXISTS public.cancellation_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  detail text,
  offer_shown text,
  offer_accepted boolean DEFAULT false,
  final_action text NOT NULL DEFAULT 'canceled',
  created_at timestamptz DEFAULT now()
);

-- RLS: 본인 또는 super_admin만 조회
ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cancellation_feedback_select_own" ON public.cancellation_feedback
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "cancellation_feedback_insert_own" ON public.cancellation_feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "cancellation_feedback_select_admin" ON public.cancellation_feedback
  FOR SELECT USING (public.is_super_admin());

-- 3. subscription-renew에서 dunning 알림 생성 시 사용할 헬퍼
-- (서비스 롤로 실행되므로 RLS bypass, 단순 INSERT용)
-- notification_logs에 dunning 타입 추가는 별도 제약 없음 (type은 text)

-- 4. dunning_started_at 자동 클리어: active 복구 시
CREATE OR REPLACE FUNCTION public.clear_dunning_on_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- past_due → active 복구 시 dunning 상태 초기화
  IF OLD.status = 'past_due' AND NEW.status = 'active' THEN
    NEW.dunning_started_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_dunning_on_active ON public.subscriptions;
CREATE TRIGGER trg_clear_dunning_on_active
  BEFORE UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_dunning_on_active();

-- 5. cancellation_feedback 통계 조회 (admin용)
CREATE OR REPLACE FUNCTION public.admin_get_cancellation_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('error', 'NOT_ADMIN');
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'by_reason', jsonb_object_agg(
      COALESCE(reason, 'unknown'),
      reason_count
    ),
    'retention_rate', ROUND(
      COUNT(*) FILTER (WHERE final_action != 'canceled')::numeric /
      NULLIF(COUNT(*), 0) * 100, 1
    )
  ) INTO v_result
  FROM (
    SELECT reason, COUNT(*) as reason_count, final_action
    FROM public.cancellation_feedback
    GROUP BY reason, final_action
  ) sub;

  RETURN COALESCE(v_result, jsonb_build_object('total', 0, 'by_reason', '{}'::jsonb, 'retention_rate', 0));
END;
$$;
