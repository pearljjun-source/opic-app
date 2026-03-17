-- ============================================================================
-- 052: billing_key 암호화 (at-rest encryption)
-- ============================================================================
-- 변경 내용:
--   1. subscriptions.billing_key 컬럼에 암호화 주석 추가
--   2. 실제 데이터 암호화는 migrate-billing-keys Edge Function으로 수행
--      (AES-256-GCM, Web Crypto API — SQL에서 불가)
--
-- 배포 순서:
--   1. 이 마이그레이션 적용 (supabase db push)
--   2. BILLING_ENCRYPTION_KEY secret 설정 (supabase secrets set)
--   3. Edge Functions 배포 (암호화 코드 포함)
--   4. migrate-billing-keys Edge Function 1회 실행 (기존 평문 → 암호화)
--
-- 암호화 형식: base64(iv:ciphertext) — AES-256-GCM
-- 키 관리: BILLING_ENCRYPTION_KEY 환경변수 (64자 hex = 32바이트)
-- ============================================================================

-- billing_key 컬럼 문서화
COMMENT ON COLUMN subscriptions.billing_key IS
  'TOSS Payments 빌링키. AES-256-GCM으로 암호화 저장 (migrate-billing-keys 함수로 마이그레이션). 형식: base64(iv:ciphertext)';

-- billing_key에 직접 접근하는 RLS 정책이 없으므로 추가 조치 불필요
-- Edge Function (service_role)만 읽기/쓰기 가능
