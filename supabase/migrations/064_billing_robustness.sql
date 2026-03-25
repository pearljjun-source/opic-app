-- 064_billing_robustness.sql
-- 결제 시스템 견고성 강화: 멱등성 + 동시성 보호 인덱스

-- 1. payment_history.provider_payment_id UNIQUE (멱등성: 동일 paymentKey로 중복 결제 이력 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_history_provider_payment_id_unique
  ON payment_history (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- 2. subscriptions.provider_subscription_id 인덱스 (웹훅 reconciliation 매칭 속도)
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id
  ON subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- 3. 조직당 incomplete 구독 1개 제한 (동시 결제 요청 DB 레벨 차단)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_org_incomplete_unique
  ON subscriptions (organization_id)
  WHERE status = 'incomplete';
