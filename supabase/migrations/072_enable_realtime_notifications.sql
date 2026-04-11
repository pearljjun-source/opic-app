-- ============================================================================
-- 072: Enable Realtime for notification_logs
-- notification_logs 테이블을 Supabase Realtime 구독 가능하게 등록
-- RLS가 이미 user_id = auth.uid()로 설정되어 있어, 본인 알림만 수신됨
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_logs;
