-- 025_cleanup_goodday_data.sql
-- 굿데이영어 (pearljjun@gmail.com) 관련 데이터 정리
-- 이 마이그레이션은 일회성 데이터 정리용이며, 스키마 변경 없음

BEGIN;

-- 1. admin_audit_log: 불변 트리거 임시 비활성화 후 삭제
ALTER TABLE public.admin_audit_log DISABLE TRIGGER no_audit_update;
ALTER TABLE public.admin_audit_log DISABLE TRIGGER no_audit_delete;

DELETE FROM public.admin_audit_log
WHERE admin_id = '0e652a1d-1683-4c6b-962f-e028196dd17b';

ALTER TABLE public.admin_audit_log ENABLE TRIGGER no_audit_update;
ALTER TABLE public.admin_audit_log ENABLE TRIGGER no_audit_delete;

-- 2. public.users 삭제 (pearljjun@gmail.com)
DELETE FROM public.users
WHERE id = '0e652a1d-1683-4c6b-962f-e028196dd17b';

COMMIT;
