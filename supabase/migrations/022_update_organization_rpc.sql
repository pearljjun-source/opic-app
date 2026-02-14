-- ============================================================================
-- 022: update_organization_name RPC + organizations 컬럼 보호 트리거
-- ============================================================================
-- 근본 원인: updateOrganization()이 직접 .update() 사용
--   → RLS silent fail (C1), 컬럼 보호 부재 (C3), 패턴 불일치 (W1)
--
-- 해결:
--   1. update_organization_name RPC (SECURITY DEFINER) — name만 변경 가능
--   2. protect_organization_columns 트리거 — PostgREST 직접 수정 방어
--   3. organizations_update 정책 유지 (기존 RPC가 아닌 경로도 보호)
-- ============================================================================

-- ============================================================================
-- 1. protect_organization_columns 트리거
-- ============================================================================
-- protect_user_columns와 동일 패턴:
--   authenticated/anon → id, owner_id, created_at, deleted_at 변경 차단
--   SECURITY DEFINER (postgres role) → 자동 bypass

CREATE OR REPLACE FUNCTION public.protect_organization_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER 함수는 current_user = 'postgres' → 자동 bypass
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 보호 컬럼 강제 복원
  NEW.id := OLD.id;
  NEW.owner_id := OLD.owner_id;
  NEW.created_at := OLD.created_at;
  NEW.deleted_at := OLD.deleted_at;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_organization_columns
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_organization_columns();

COMMENT ON FUNCTION public.protect_organization_columns IS
  'PostgREST 경유 시 organizations 보호 컬럼(id, owner_id, created_at, deleted_at) 변경 차단';

-- ============================================================================
-- 2. update_organization_name RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_organization_name(p_org_id uuid, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_trimmed text;
  v_rows_affected integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 이름 검증
  v_trimmed := trim(p_name);
  IF v_trimmed IS NULL OR char_length(v_trimmed) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NAME_REQUIRED');
  END IF;

  IF char_length(v_trimmed) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NAME_TOO_LONG');
  END IF;

  -- caller가 owner인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = v_user_id
      AND role = 'owner' AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'OWNER_ONLY');
  END IF;

  -- 이름 업데이트
  UPDATE public.organizations
  SET name = v_trimmed
  WHERE id = p_org_id AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.update_organization_name IS 'Owner: 학원명 수정 (name 컬럼만 변경 가능)';
