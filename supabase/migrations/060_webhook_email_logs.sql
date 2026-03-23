-- 060_webhook_email_logs.sql
-- 용도: Webhook 이벤트 로깅 + 이메일 발송 로깅
-- Phase B: 결제 디버깅 + 비즈니스 이메일 감사 추적

-- ============================================================================
-- 1. webhook_logs: TOSS 웹훅 이벤트 기록
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,                      -- DONE, CANCELED, FAILED, INVALID_SIGNATURE 등
  payload jsonb NOT NULL DEFAULT '{}',           -- 웹훅 원본 body
  response jsonb,                                -- 응답 내용
  status_code int NOT NULL DEFAULT 200,          -- HTTP 응답 코드
  processing_time_ms int,                        -- 처리 시간 (ms)
  error_message text,                            -- 에러 메시지 (실패 시)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_event_type ON public.webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- super_admin만 조회 가능 (어드민 대시보드용)
CREATE POLICY "super_admin_read_webhook_logs" ON public.webhook_logs
  FOR SELECT USING (public.is_super_admin());

-- ============================================================================
-- 2. email_logs: 비즈니스 이메일 발송 기록
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  template_type text NOT NULL,                   -- payment_confirmation, trial_expiry, dunning, cancellation, refund
  subject text NOT NULL,
  provider_id text,                              -- Resend message ID
  status text NOT NULL DEFAULT 'sent',           -- sent, failed
  error_message text,
  metadata jsonb DEFAULT '{}',                   -- 추가 컨텍스트 (org_id, sub_id 등)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_template_type ON public.email_logs(template_type);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_email_logs" ON public.email_logs
  FOR SELECT USING (public.is_super_admin());
