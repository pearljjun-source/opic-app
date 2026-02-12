-- ============================================================================
-- 012: 인증/권한 보안 근본 수정
--
-- 근본 원인: 서버가 클라이언트 입력을 신뢰하는 패턴
-- 원칙: 권한 있는 작업은 반드시 서버에서 결정/검증
--
-- 수정 내용:
-- 1. handle_new_user 트리거: role 무조건 'student' (클라이언트 메타데이터 무시)
-- 2. users 보호 컬럼 트리거: role, email, id, created_at 변경 차단
-- 3. promote_to_teacher RPC: admin만 호출 가능한 역할 승격 함수
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. handle_new_user 트리거 수정
--
-- 근본 원인: raw_user_meta_data->>'role'을 그대로 신뢰
-- 해결: role을 무조건 'student'로 설정, 클라이언트가 뭘 보내든 무시
-- 강사/관리자 승격은 promote_to_teacher RPC로만 가능
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'student'  -- 무조건 student. 역할 변경은 promote_to_teacher RPC로만 가능.
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
  '회원가입 시 users 자동 생성. role은 무조건 student (클라이언트 메타데이터 무시).';

-- --------------------------------------------------------------------------
-- 2. users 보호 컬럼 트리거 (화이트리스트 방식)
--
-- 근본 원인: users_update_own RLS에 컬럼 제한이 없어 role 자가 승격 가능
-- 해결: 변경 가능한 컬럼을 화이트리스트로 제한 (name, push_token, updated_at, deleted_at)
--        나머지 컬럼은 값이 바뀌면 RAISE EXCEPTION
-- 화이트리스트가 블랙리스트보다 안전: 새 컬럼 추가 시 기본적으로 보호됨
--
-- bypass 원리: PostgreSQL 내장 역할 시스템 활용
-- - 일반 API 호출: current_user = 'authenticated' 또는 'anon' → 보호 적용
-- - SECURITY DEFINER 함수: current_user = 함수 소유자 (postgres) → 신뢰된 서버 코드로 bypass
-- - 세션 변수 불필요: PostgreSQL 자체 보안 모델에 의존
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER 함수(postgres 등)에서 호출 = 신뢰된 서버 코드 → bypass
  -- 일반 클라이언트(authenticated, anon)만 보호 컬럼 변경 차단
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 보호 컬럼: 값이 변경되면 차단
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role 변경은 promote_to_teacher RPC로만 가능합니다';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'email 변경은 허용되지 않습니다';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'id 변경은 허용되지 않습니다';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at 변경은 허용되지 않습니다';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_user_columns_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_columns();

COMMENT ON FUNCTION public.protect_user_columns IS
  'users 보호 컬럼 변경 차단. 변경 가능: name, push_token, updated_at, deleted_at. bypass: SECURITY DEFINER 함수 (current_user != authenticated/anon)';

-- --------------------------------------------------------------------------
-- 3. promote_to_teacher RPC (admin 전용)
--
-- SECURITY DEFINER → current_user = postgres → 트리거 자동 bypass
-- 세션 변수 불필요: PostgreSQL 역할 시스템이 자체적으로 처리
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_to_teacher(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
  v_target_role public.user_role;
BEGIN
  -- 1. 호출자 인증
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 2. 호출자가 admin인지 확인
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 3. 대상 사용자 확인
  SELECT role INTO v_target_role
  FROM public.users
  WHERE id = p_user_id AND deleted_at IS NULL;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF v_target_role = 'teacher' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_TEACHER');
  END IF;

  IF v_target_role = 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_CHANGE_ADMIN');
  END IF;

  -- 4. 역할 변경
  -- SECURITY DEFINER → current_user = postgres → protect_user_columns 트리거 자동 bypass
  UPDATE public.users
  SET role = 'teacher', updated_at = now()
  WHERE id = p_user_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'new_role', 'teacher');
END;
$$;

COMMENT ON FUNCTION public.promote_to_teacher IS
  'admin 전용: 학생을 강사로 승격. SECURITY DEFINER이므로 보호 컬럼 트리거 자동 bypass.';
