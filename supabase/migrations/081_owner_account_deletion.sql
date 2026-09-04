-- ============================================================================
-- 081: 학원 대표(owner)도 탈퇴할 수 있게 한다
--
-- 문제:
--   organizations.owner_id 는 NOT NULL 이고 ON DELETE 절이 없어(NO ACTION)
--   학원을 소유한 계정은 auth.users 삭제가 FK 위반으로 실패한다.
--   delete-user 는 Storage 녹음 파일을 먼저 지우므로,
--   "파일은 지워졌는데 계정은 남는" 중간 상태가 된다.
--
--   그런데 약관·개인정보처리방침은 "언제든지 탈퇴할 수 있다"고 고지하고 있고,
--   개인정보보호법 제36조(파기 요구권)에도 예외가 없다.
--
-- 해결:
--   구독을 해지한 뒤 탈퇴하는 경로를 만든다. 원장이 결제 주체이므로
--   "구독 해지 → 학원 폐원 → 탈퇴" 가 자연스러운 순서다.
--
--   1. owner_id 를 nullable + ON DELETE SET NULL 로 바꿔 FK 가 탈퇴를 막지 않게 한다
--   2. 대신 활성 구독이 있으면 서버가 탈퇴를 거부한다 (delete-user Edge Function).
--      결제가 살아 있는 채로 탈퇴하면 "탈퇴했는데 카드에서 돈이 나가는" 상황이 된다
--   3. 탈퇴 시 학원은 soft delete 된다. 하드 삭제하면 소속 학생·강사 데이터가
--      함께 날아간다
--
-- 구성원 통보는 하지 않는다 (제품 결정, 2026-09-04)
--   원장이 학원을 닫기로 했다면 소속 강사·학생에게는 이미 알렸을 것이다.
--   학원 내부 커뮤니케이션은 원장의 몫이고, 우리 책임은 원장이 탈퇴하겠다고 할 때
--   탈퇴할 수 있게 하는 데까지다.
--   탈퇴 화면에서 "구성원 N명이 학원 연결을 잃는다"고 알려주는 것으로 충분하다.
--   → 자동 통보·유예기간·소유권 이전을 이 기능의 누락으로 보고 추가하지 말 것.
-- ============================================================================

-- 1. owner_id 가 탈퇴를 막지 않도록
ALTER TABLE public.organizations
  ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_owner_id_fkey;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.organizations.owner_id IS
  '학원 대표. 대표가 탈퇴하면 NULL 이 되고 학원은 soft delete 된다 (081)';

-- 2. 원장 탈퇴 시 학원 자동 폐원 (soft delete)
--
--    owner_id 가 SET NULL 되는 시점에 학원을 닫는다. Edge Function 에서 처리할 수도
--    있지만, 어떤 경로로 사용자가 삭제되든(관리자 도구, SQL 직접 실행 포함)
--    학원이 주인 없이 살아 있는 상태를 만들지 않으려면 DB 에 두는 것이 확실하다.
CREATE OR REPLACE FUNCTION public._close_org_on_owner_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- owner_id 가 값에서 NULL 로 바뀐 경우에만 (대표 탈퇴)
  IF OLD.owner_id IS NOT NULL AND NEW.owner_id IS NULL AND NEW.deleted_at IS NULL THEN
    NEW.deleted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_org_on_owner_delete ON public.organizations;
CREATE TRIGGER trg_close_org_on_owner_delete
  BEFORE UPDATE OF owner_id ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public._close_org_on_owner_delete();

-- 3. 탈퇴 가능 여부 조회 (클라이언트 안내용)
--
--    ⚠️ 이 함수는 안내일 뿐 강제가 아니다. 실제 차단은 delete-user Edge Function 이
--       서버에서 다시 확인한다. 클라이언트 확인만 믿으면 우회할 수 있다.
CREATE OR REPLACE FUNCTION public.check_account_deletable()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_org record;
  v_member_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('deletable', false, 'reason', 'NOT_AUTHENTICATED');
  END IF;

  -- 소유한 학원 (soft delete 되지 않은 것)
  SELECT o.id, o.name INTO v_org
  FROM public.organizations o
  WHERE o.owner_id = v_user_id AND o.deleted_at IS NULL
  LIMIT 1;

  IF v_org.id IS NULL THEN
    RETURN jsonb_build_object('deletable', true, 'is_owner', false);
  END IF;

  -- 활성 구독이 있으면 먼저 해지해야 한다
  IF EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.organization_id = v_org.id
      AND s.status IN ('active', 'trialing', 'past_due')
  ) THEN
    RETURN jsonb_build_object(
      'deletable', false,
      'reason', 'SUBSCRIPTION_ACTIVE',
      'is_owner', true,
      'org_name', v_org.name
    );
  END IF;

  -- 남은 구성원 수 (본인 제외) — 경고에 쓴다
  SELECT count(*) INTO v_member_count
  FROM public.organization_members m
  WHERE m.organization_id = v_org.id
    AND m.user_id != v_user_id
    AND m.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'deletable', true,
    'is_owner', true,
    'org_name', v_org.name,
    'member_count', v_member_count
  );
END;
$$;

COMMENT ON FUNCTION public.check_account_deletable IS
  '탈퇴 가능 여부와 경고에 필요한 정보 (안내용. 강제는 delete-user 가 한다)';

NOTIFY pgrst, 'reload schema';
