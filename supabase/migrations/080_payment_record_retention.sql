-- ============================================================================
-- 080: 탈퇴해도 결제 기록은 남는다 (전자상거래법 5년 보존)
--
-- 문제:
--   payment_history.user_id 와 subscriptions.user_id 가 ON DELETE CASCADE 라
--   회원 탈퇴 시 결제 기록이 전부 삭제된다. 그런데
--
--   · 개인정보처리방침 제4조 ②는 "결제 및 공급에 관한 기록: 5년" 으로 고지하고 있고
--   · 전자상거래법 제6조는 대금결제·재화공급 기록을 5년간 보존하도록 정하고 있다
--
--   즉 지금 구현은 고지한 내용과도, 법정 보존 의무와도 어긋난다.
--
-- 해결:
--   결제 기록을 지우는 대신 개인 식별자만 끊는다(NULL). 금액·결제수단·영수증·
--   결제 시각 같은 거래 정보는 그대로 남아 5년 보존 의무를 충족하고,
--   탈퇴자와의 연결은 사라져 개인정보는 파기된다.
--
--   organization_id 를 스냅샷으로 남긴다. 조직은 사업자 정보라 개인정보가 아니고,
--   subscription 이 지워진 뒤에도 어느 학원의 거래였는지 남아야 정산·분쟁 대응이 된다.
--
-- ⚠️ 이 마이그레이션은 정책 판단이 섞여 있다. 보존 항목을 바꾸려면 개인정보처리방침
--    제4조와 함께 수정할 것. 한쪽만 바꾸면 고지와 구현이 또 어긋난다.
-- ============================================================================

-- 1. 거래 주체 스냅샷 (조직 단위)
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.payment_history.organization_id IS
  '결제 시점의 조직. subscription 이 삭제돼도 어느 학원의 거래였는지 남긴다';

-- 기존 행 백필: subscription 을 통해 조직을 찾는다
UPDATE public.payment_history ph
SET organization_id = s.organization_id
FROM public.subscriptions s
WHERE ph.subscription_id = s.id
  AND ph.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

-- 2. 탈퇴 시 결제 기록이 함께 지워지지 않도록 FK 를 SET NULL 로 바꾼다
ALTER TABLE public.payment_history
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.payment_history
  DROP CONSTRAINT IF EXISTS payment_history_user_id_fkey;

ALTER TABLE public.payment_history
  ADD CONSTRAINT payment_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. subscription 이 지워져도 결제 기록은 남는다
--    (subscriptions.user_id 는 여전히 CASCADE 이므로 탈퇴 시 구독 행은 사라진다.
--     구독은 계약 상태이지 거래기록이 아니므로 보존 대상이 아니다)
ALTER TABLE public.payment_history
  ALTER COLUMN subscription_id DROP NOT NULL;

ALTER TABLE public.payment_history
  DROP CONSTRAINT IF EXISTS payment_history_subscription_id_fkey;

ALTER TABLE public.payment_history
  ADD CONSTRAINT payment_history_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;

-- 4. organization_id 자동 채움
--
--    결제 이력을 만드는 곳이 billing-key / change-plan / subscription-renew(3곳) 로
--    흩어져 있다. 각 INSERT 에 컬럼을 하나씩 추가하면 앞으로 생길 결제 경로에서
--    빠뜨리기 쉽다. 서버(DB)가 subscription 을 보고 직접 채우게 한다.
CREATE OR REPLACE FUNCTION public._payment_history_fill_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.subscription_id IS NOT NULL THEN
    SELECT s.organization_id INTO NEW.organization_id
    FROM public.subscriptions s
    WHERE s.id = NEW.subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_history_fill_org ON public.payment_history;
CREATE TRIGGER trg_payment_history_fill_org
  BEFORE INSERT ON public.payment_history
  FOR EACH ROW EXECUTE FUNCTION public._payment_history_fill_org();

-- 5. 조직별 조회 인덱스 (관리자 결제 내역 화면)
CREATE INDEX IF NOT EXISTS idx_payment_history_org
  ON public.payment_history(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- ============================================================================
-- RLS: 탈퇴자 기록(user_id IS NULL)은 일반 사용자에게 보이지 않아야 한다
-- ============================================================================

-- 기존 정책이 user_id = auth.uid() 기준이면 NULL 은 자동으로 제외된다.
-- 다만 조직 기반 정책이 있다면 탈퇴자 기록이 원장에게 보일 수 있으므로 확인 필요.
-- (관리자 화면은 SECURITY DEFINER RPC 를 쓰므로 영향 없음)

COMMENT ON TABLE public.payment_history IS
  '결제 이력. 전자상거래법 5년 보존 대상이라 회원 탈퇴 시 user_id 만 NULL 로 끊고 행은 유지한다';

NOTIFY pgrst, 'reload schema';
