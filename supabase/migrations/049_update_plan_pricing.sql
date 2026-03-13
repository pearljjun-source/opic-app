-- ============================================================================
-- 049: 구독 플랜 가격 조정
-- 목적: API 원가 + 인프라/운영비 기반 현실적 가격 책정
-- ============================================================================
-- 변경 내역:
--   Solo:    19,900 → 29,900원/월, 189,000 → 279,000원/연 (약 22% 할인)
--   Pro:     39,900 → 69,900원/월, 379,000 → 659,000원/연 (약 21% 할인)
--   Academy: 79,900 → 199,000원/월, 759,000 → 1,890,000원/연 (약 21% 할인)
-- ============================================================================

-- Solo: 29,900원/월
UPDATE public.subscription_plans
SET price_monthly = 29900,
    price_yearly = 279000,
    updated_at = now()
WHERE plan_key = 'solo';

-- Pro: 69,900원/월
UPDATE public.subscription_plans
SET price_monthly = 69900,
    price_yearly = 659000,
    updated_at = now()
WHERE plan_key = 'pro';

-- Academy: 199,000원/월
UPDATE public.subscription_plans
SET price_monthly = 199000,
    price_yearly = 1890000,
    updated_at = now()
WHERE plan_key = 'academy';
