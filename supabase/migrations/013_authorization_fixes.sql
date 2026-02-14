-- ============================================================================
-- 013: 인가(Authorization) 검증 + 데이터 무결성(TOCTOU 방지)
--
-- Part A: 인가 검증 일관 적용
-- 근본 원인: 인증(Authentication) ≠ 인가(Authorization) 구분 실패
-- 원칙: 모든 데이터 접근 경로에 인가를 일관되게 적용
--
-- Part B: TOCTOU(Time-of-Check-to-Time-of-Use) 레이스 컨디션 방지
-- 근본 원인: "확인 후 행동" 패턴에서 확인과 행동 사이에 상태 변경 가능
-- 해결: 원자적 연산으로 확인+행동을 단일 SQL 문으로 결합
--
-- 수정 내용:
-- 1. notification_logs: created_by + resource_id 컬럼, UNIQUE 인덱스
-- 2. notify_action RPC: ON CONFLICT DO NOTHING (원자적 중복 방지)
-- 3. use_invite_code RPC: CAS 패턴 (원자적 상태 전환)
-- 4. soft_delete_invite RPC: 강사 소유권 검증 포함
-- 5. get_student_practice_stats: auth.uid() + 연결 관계 검증
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. notification_logs에 created_by 컬럼 추가
--
-- 알림을 생성하게 한 행위자를 기록 (수신자 user_id와 구분)
-- 예: 학생이 연습 완료 → created_by = 학생, user_id = 강사
-- deliver-notification에서 created_by = auth.uid() 검증에 사용
-- --------------------------------------------------------------------------
ALTER TABLE public.notification_logs
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);

COMMENT ON COLUMN public.notification_logs.created_by IS
  '알림을 생성하게 한 행위자 (수신자 user_id와 구분). deliver-notification 인가 검증에 사용.';

-- --------------------------------------------------------------------------
-- 1b. notification_logs에 resource_id 컬럼 + UNIQUE 인덱스 추가
--
-- TOCTOU 방지: SELECT로 중복 확인 → INSERT 사이에 다른 요청이 끼어들 수 있음
-- 해결: DB 레벨 UNIQUE 제약 + ON CONFLICT DO NOTHING으로 원자적 중복 방지
-- --------------------------------------------------------------------------
ALTER TABLE public.notification_logs
ADD COLUMN IF NOT EXISTS resource_id uuid;

COMMENT ON COLUMN public.notification_logs.resource_id IS
  '알림의 원인이 된 리소스 ID (practice_id, script_id, invite_id 등). UNIQUE 인덱스로 중복 방지.';

-- 부분 UNIQUE 인덱스: 삭제되지 않은 알림에 대해서만 중복 방지
-- (type, user_id, resource_id) 조합이 유일해야 함
-- 주의: 011에서 같은 이름의 non-unique 인덱스가 먼저 생성됨.
-- IF NOT EXISTS는 이름만 확인하므로 UNIQUE 업그레이드가 스킵됨 → DROP 후 재생성 필요.
-- ON CONFLICT 절의 WHERE와 정확히 일치해야 함 (resource_id IS NOT NULL 제거)
-- NULL resource_id는 UNIQUE 인덱스에서 distinct 취급되므로 중복 허용됨 (정상)
DROP INDEX IF EXISTS public.idx_notification_logs_dedup;
CREATE UNIQUE INDEX idx_notification_logs_dedup
  ON public.notification_logs (type, user_id, resource_id)
  WHERE deleted_at IS NULL;

-- --------------------------------------------------------------------------
-- 2. notify_action RPC 수정: created_by 설정
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_action(
  p_type text,
  p_resource_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_recipient_id uuid;
  v_title text;
  v_body text;
  v_data jsonb;
  v_notification_id uuid;
  v_resource_name text;
BEGIN
  -- 1. 인증 확인
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 2. 타입별 소유권 검증 + 수신자 결정 + 알림 내용 정의
  CASE p_type

    -- practice_completed: 학생이 연습 완료 → 강사에게
    WHEN 'practice_completed' THEN
      SELECT
        s.teacher_id,
        u.name,
        q.question_text
      INTO v_recipient_id, v_resource_name, v_body
      FROM public.practices p
      JOIN public.scripts s ON s.id = p.script_id AND s.deleted_at IS NULL
      JOIN public.questions q ON q.id = s.question_id
      JOIN public.users u ON u.id = p.student_id AND u.deleted_at IS NULL
      WHERE p.id = p_resource_id
        AND p.student_id = v_caller_id
        AND p.deleted_at IS NULL;

      IF v_recipient_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'RESOURCE_NOT_FOUND');
      END IF;

      v_title := v_resource_name || '님이 연습을 완료했습니다';
      v_body := left(v_body, 100);
      v_data := jsonb_build_object('practice_id', p_resource_id);

    -- teacher_feedback: 강사가 피드백 작성 → 학생에게
    WHEN 'teacher_feedback' THEN
      SELECT
        p.student_id,
        u.name,
        q.question_text
      INTO v_recipient_id, v_resource_name, v_body
      FROM public.practices p
      JOIN public.scripts s ON s.id = p.script_id AND s.deleted_at IS NULL
      JOIN public.questions q ON q.id = s.question_id
      JOIN public.users u ON u.id = s.teacher_id AND u.deleted_at IS NULL
      WHERE p.id = p_resource_id
        AND s.teacher_id = v_caller_id
        AND p.deleted_at IS NULL;

      IF v_recipient_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'RESOURCE_NOT_FOUND');
      END IF;

      v_title := v_resource_name || ' 강사님이 피드백을 남겼습니다';
      v_body := left(v_body, 100);
      v_data := jsonb_build_object('practice_id', p_resource_id);

    -- new_script: 강사가 스크립트 작성 → 학생에게
    WHEN 'new_script' THEN
      SELECT
        s.student_id,
        u.name,
        q.question_text
      INTO v_recipient_id, v_resource_name, v_body
      FROM public.scripts s
      JOIN public.questions q ON q.id = s.question_id
      JOIN public.users u ON u.id = s.teacher_id AND u.deleted_at IS NULL
      WHERE s.id = p_resource_id
        AND s.teacher_id = v_caller_id
        AND s.deleted_at IS NULL;

      IF v_recipient_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'RESOURCE_NOT_FOUND');
      END IF;

      v_title := v_resource_name || ' 강사님이 새 스크립트를 작성했습니다';
      v_body := left(v_body, 100);
      v_data := jsonb_build_object('script_id', p_resource_id);

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'INVALID_TYPE');
  END CASE;

  -- 3. 원자적 중복 방지 INSERT (TOCTOU 방지)
  -- IF EXISTS → INSERT 대신 ON CONFLICT DO NOTHING 사용
  -- UNIQUE 인덱스 (type, user_id, resource_id) WHERE deleted_at IS NULL이 보장
  INSERT INTO public.notification_logs (type, user_id, title, body, data, created_by, resource_id)
  VALUES (p_type, v_recipient_id, v_title, v_body, v_data, v_caller_id, p_resource_id)
  ON CONFLICT (type, user_id, resource_id) WHERE deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_notification_id;

  -- ON CONFLICT DO NOTHING → RETURNING이 NULL (이미 존재)
  IF v_notification_id IS NULL THEN
    SELECT id INTO v_notification_id
    FROM public.notification_logs
    WHERE type = p_type
      AND user_id = v_recipient_id
      AND resource_id = p_resource_id
      AND deleted_at IS NULL
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'notification_log_id', v_notification_id,
      'already_exists', true
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'notification_log_id', v_notification_id,
    'already_exists', false
  );
END;
$$;

COMMENT ON FUNCTION public.notify_action IS
  '알림 생성 전용 RPC. 호출자 소유권 검증 + 서버 결정 수신자 + created_by 기록 + 리소스 기반 중복 방지.';

-- --------------------------------------------------------------------------
-- 3. use_invite_code 수정: created_by 설정
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.use_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_user_name text;
  v_invite record;
  v_notification_id uuid;
  v_rows_affected int;
BEGIN
  -- 현재 사용자 확인
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 역할 확인 (삭제된 사용자 제외)
  SELECT role, name INTO v_user_role, v_user_name
  FROM public.users
  WHERE id = v_user_id
    AND deleted_at IS NULL;

  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF v_user_role != 'student' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_STUDENT');
  END IF;

  -- 유효한 초대 코드 찾기 (삭제되지 않은 것만)
  SELECT * INTO v_invite
  FROM public.invites
  WHERE code = upper(trim(p_code))
    AND status = 'pending'
    AND expires_at > now()
    AND deleted_at IS NULL;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  -- 강사가 삭제되었는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_invite.teacher_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'TEACHER_NOT_FOUND');
  END IF;

  -- 이미 연결되어 있는지 확인 (삭제되지 않은 연결만)
  IF EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = v_invite.teacher_id
      AND student_id = v_user_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CONNECTED');
  END IF;

  -- 초대 코드 사용 처리 (CAS: 원자적 상태 전환)
  -- TOCTOU 방지: SELECT(pending 확인)와 UPDATE 사이에 다른 트랜잭션이 상태 변경 가능
  -- WHERE status = 'pending' 조건으로 확인+변경을 단일 SQL문에서 원자적으로 수행
  UPDATE public.invites
  SET status = 'used', used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id
    AND status = 'pending';

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- 0이면 SELECT 이후 다른 사용자가 먼저 사용한 것
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

  -- 강사-학생 연결
  INSERT INTO public.teacher_student (teacher_id, student_id)
  VALUES (v_invite.teacher_id, v_user_id);

  -- 알림 생성: 강사에게 학생 연결 알림 (created_by + resource_id 포함)
  INSERT INTO public.notification_logs (type, user_id, title, body, data, created_by, resource_id)
  VALUES (
    'student_connected',
    v_invite.teacher_id,
    v_user_name || '님이 연결되었습니다',
    '새로운 학생이 초대 코드를 사용하여 연결되었습니다.',
    jsonb_build_object('student_id', v_user_id, 'invite_id', v_invite.id),
    v_user_id,
    v_invite.id
  )
  ON CONFLICT (type, user_id, resource_id) WHERE deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_invite.teacher_id,
    'notification_log_id', v_notification_id
  );
END;
$$;

COMMENT ON FUNCTION public.use_invite_code IS
  '초대 코드 사용 (학생용, 삭제된 데이터 제외, 강사 알림 + created_by 포함)';

-- --------------------------------------------------------------------------
-- 4. soft_delete_invite RPC (강사 소유권 검증 포함)
--
-- 006_soft_delete.sql에서 invites_delete_teacher RLS를 DROP하고 재생성 안 함
-- 클라이언트 hard delete → silent fail 상태
-- 근본 해결: soft delete RPC (서버가 소유권 검증)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_teacher_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 초대 코드 소유자 확인
  SELECT teacher_id INTO v_teacher_id
  FROM public.invites
  WHERE id = p_invite_id AND deleted_at IS NULL;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- 본인 소유만 삭제 가능
  IF v_caller_id != v_teacher_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- Soft Delete
  UPDATE public.invites
  SET deleted_at = now()
  WHERE id = p_invite_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_invite IS
  '초대 코드 삭제 (강사 전용, 소유권 검증 포함, Soft Delete)';

-- --------------------------------------------------------------------------
-- 5. get_student_practice_stats 수정: auth.uid() + 연결 관계 검증
--
-- 근본 원인: SECURITY DEFINER인데 호출자 검증 없음
-- → 아무나 아무 학생의 통계 조회 가능
-- 해결: 본인이거나 연결된 강사만 조회 가능
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_practice_stats(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
  v_result jsonb;
BEGIN
  -- 1. 인증 확인
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 2. 인가 확인: 본인이거나 연결된 강사만 허용
  IF v_caller_id = p_student_id THEN
    -- 본인 조회: 허용
    NULL;
  ELSE
    -- 연결된 강사인지 확인
    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = v_caller_id AND deleted_at IS NULL;

    IF v_caller_role != 'teacher' AND v_caller_role != 'admin' THEN
      RETURN jsonb_build_object('error', 'UNAUTHORIZED');
    END IF;

    IF v_caller_role = 'teacher' AND NOT EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id
        AND student_id = p_student_id
        AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'NOT_CONNECTED');
    END IF;
  END IF;

  -- 3. 통계 조회
  SELECT jsonb_build_object(
    'total_practices', COUNT(*),
    'total_duration_minutes', COALESCE(SUM(duration) / 60, 0),
    'avg_score', COALESCE(ROUND(AVG(score)::numeric, 1), 0),
    'avg_reproduction_rate', COALESCE(ROUND(AVG(reproduction_rate)::numeric, 1), 0),
    'this_week_practices', COUNT(*) FILTER (WHERE created_at > now() - interval '7 days'),
    'last_practice_at', MAX(created_at)
  ) INTO v_result
  FROM public.practices
  WHERE student_id = p_student_id
    AND deleted_at IS NULL;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_student_practice_stats IS
  '학생 연습 통계 조회 (본인 또는 연결된 강사만 허용, 삭제된 연습 제외)';
