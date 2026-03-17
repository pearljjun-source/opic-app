-- ============================================================================
-- 053: create_organization RPC 함수 삭제
-- ============================================================================
-- 사유:
--   - 원장 초대는 admin_create_owner_invite → use_invite_code 내부에서
--     직접 INSERT INTO organizations 수행 (023 마이그레이션)
--   - create_organization은 클라이언트에서 미사용이나 PostgREST 엔드포인트로
--     노출되어 있어 인증된 사용자가 누구나 학원 owner가 될 수 있는 보안 위험
--   - 셀프 서비스 학원 생성(경로 2) 설계 폐기에 따른 정리
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_organization(text, text);
