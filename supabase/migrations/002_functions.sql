-- ============================================================================
-- OPIc 학습 앱 - Functions & Triggers
-- ============================================================================

-- ============================================================================
-- 1. TRIGGER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 updated_at 자동 갱신 트리거 함수
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- users 테이블에 트리거 적용
CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- scripts 테이블에 트리거 적용
CREATE TRIGGER on_scripts_updated
  BEFORE UPDATE ON public.scripts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- app_config 테이블에 트리거 적용
CREATE TRIGGER on_app_config_updated
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 1.2 회원가입 시 users 테이블 자동 생성 트리거
-- ----------------------------------------------------------------------------
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
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 사용자 역할 가져오기
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = p_user_id;
$$;

-- ----------------------------------------------------------------------------
-- 2.2 연결된 학생인지 확인
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_connected_student(
  p_teacher_id uuid,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = p_teacher_id AND student_id = p_student_id
  );
$$;

-- ============================================================================
-- 3. BUSINESS LOGIC FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 초대 코드 생성
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    -- 6자리 영문+숫자 코드 생성 (혼동 문자 제외: 0, O, I, L)
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    new_code := replace(replace(replace(replace(new_code, '0', 'X'), 'O', 'Y'), 'I', 'Z'), 'L', 'W');

    -- 중복 체크
    SELECT EXISTS(
      SELECT 1 FROM public.invites WHERE code = new_code
    ) INTO code_exists;

    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN new_code;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.2 초대 코드 생성 (강사용) - 전체 플로우
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_invite(
  p_expires_in_days int DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_code text;
  v_invite_id uuid;
BEGIN
  -- 현재 사용자 확인
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 역할 확인
  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

  IF v_user_role != 'teacher' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_TEACHER');
  END IF;

  -- 코드 생성
  v_code := public.generate_invite_code();

  -- 초대 코드 저장
  INSERT INTO public.invites (teacher_id, code, expires_at)
  VALUES (v_user_id, v_code, now() + (p_expires_in_days || ' days')::interval)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'code', v_code,
    'expires_at', now() + (p_expires_in_days || ' days')::interval
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.3 초대 코드 사용 (학생용)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.use_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_invite record;
BEGIN
  -- 현재 사용자 확인
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 역할 확인
  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

  IF v_user_role != 'student' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_STUDENT');
  END IF;

  -- 유효한 초대 코드 찾기
  SELECT * INTO v_invite
  FROM public.invites
  WHERE code = upper(trim(p_code))
    AND status = 'pending'
    AND expires_at > now();

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  -- 이미 연결되어 있는지 확인
  IF EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = v_invite.teacher_id AND student_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CONNECTED');
  END IF;

  -- 초대 코드 사용 처리
  UPDATE public.invites
  SET status = 'used', used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id;

  -- 강사-학생 연결
  INSERT INTO public.teacher_student (teacher_id, student_id)
  VALUES (v_invite.teacher_id, v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_invite.teacher_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.4 만료된 초대 코드 정리 (스케줄러용)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.invites
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.5 학생의 연습 통계 조회
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_practice_stats(p_student_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'total_practices', COUNT(*),
    'total_duration_minutes', COALESCE(SUM(duration) / 60, 0),
    'avg_score', COALESCE(ROUND(AVG(score)::numeric, 1), 0),
    'avg_reproduction_rate', COALESCE(ROUND(AVG(reproduction_rate)::numeric, 1), 0),
    'this_week_practices', COUNT(*) FILTER (WHERE created_at > now() - interval '7 days'),
    'last_practice_at', MAX(created_at)
  )
  FROM public.practices
  WHERE student_id = p_student_id;
$$;

-- ----------------------------------------------------------------------------
-- 3.6 API Rate Limiting 체크
-- 용도: Edge Function에서 호출하여 사용자의 API 호출 횟수 제한
-- 반환: { allowed: boolean, current_count: int, limit: int, reset_at: timestamptz }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_user_id uuid,
  p_api_type public.api_type,
  p_max_requests int DEFAULT 30,
  p_window_minutes int DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
  v_window_start timestamptz;
  v_reset_at timestamptz;
BEGIN
  -- 시간 윈도우 계산
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;
  v_reset_at := now() + (p_window_minutes || ' minutes')::interval;

  -- 현재 윈도우 내 호출 횟수 조회
  SELECT COUNT(*) INTO v_count
  FROM public.api_usage
  WHERE user_id = p_user_id
    AND api_type = p_api_type
    AND called_at > v_window_start;

  -- 결과 반환
  RETURN jsonb_build_object(
    'allowed', v_count < p_max_requests,
    'current_count', v_count,
    'limit', p_max_requests,
    'remaining', GREATEST(p_max_requests - v_count, 0),
    'reset_at', v_reset_at
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3.7 API 사용량 기록 (Edge Function에서 호출)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_api_usage(
  p_user_id uuid,
  p_api_type public.api_type,
  p_tokens_used int DEFAULT NULL,
  p_duration_ms int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.api_usage (user_id, api_type, tokens_used, duration_ms)
  VALUES (p_user_id, p_api_type, p_tokens_used, p_duration_ms)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
