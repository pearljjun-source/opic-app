-- ============================================================================
-- 011: 알림 RPC 함수
--
-- notify_action(p_type, p_resource_id): 알림 생성 전용 SECURITY DEFINER 함수
-- - 데이터 조작은 기존 RLS 유지, 알림 생성만 SECURITY DEFINER로 수행
-- - 호출자 소유권 검증 (auth.uid() 기반)
-- - 리소스 기반 중복 방지 (동일 type + resource_id 알림이 이미 존재하면 skip)
-- - 알림 title/body를 서버에서 정의 (클라이언트가 결정 불가)
--
-- use_invite_code 수정: 기존 RPC에 notification_logs INSERT 추가
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. notify_action RPC
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

    -- -----------------------------------------------------------------------
    -- practice_completed: 학생이 연습 완료 → 강사에게
    -- resource_id = practice.id
    -- -----------------------------------------------------------------------
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

    -- -----------------------------------------------------------------------
    -- teacher_feedback: 강사가 피드백 작성 → 학생에게
    -- resource_id = practice.id
    -- -----------------------------------------------------------------------
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

    -- -----------------------------------------------------------------------
    -- new_script: 강사가 스크립트 작성 → 학생에게
    -- resource_id = script.id
    -- -----------------------------------------------------------------------
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

  -- 3. 리소스 기반 중복 방지
  -- 동일 (type, resource_id via data) 알림이 이미 존재하면 skip
  IF EXISTS (
    SELECT 1 FROM public.notification_logs
    WHERE type = p_type
      AND user_id = v_recipient_id
      AND data @> v_data
      AND deleted_at IS NULL
  ) THEN
    -- 이미 존재하는 알림의 ID 반환
    SELECT id INTO v_notification_id
    FROM public.notification_logs
    WHERE type = p_type
      AND user_id = v_recipient_id
      AND data @> v_data
      AND deleted_at IS NULL
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'notification_log_id', v_notification_id,
      'already_exists', true
    );
  END IF;

  -- 4. notification_logs에 INSERT
  INSERT INTO public.notification_logs (type, user_id, title, body, data)
  VALUES (p_type, v_recipient_id, v_title, v_body, v_data)
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'notification_log_id', v_notification_id,
    'already_exists', false
  );
END;
$$;

COMMENT ON FUNCTION public.notify_action IS
  '알림 생성 전용 RPC. 호출자 소유권 검증 + 서버 결정 수신자 + 리소스 기반 중복 방지.';

-- --------------------------------------------------------------------------
-- 2. use_invite_code 수정: notification_logs INSERT 추가
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

  -- 초대 코드 사용 처리
  UPDATE public.invites
  SET status = 'used', used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id;

  -- 강사-학생 연결
  INSERT INTO public.teacher_student (teacher_id, student_id)
  VALUES (v_invite.teacher_id, v_user_id);

  -- 알림 생성: 강사에게 학생 연결 알림
  INSERT INTO public.notification_logs (type, user_id, title, body, data)
  VALUES (
    'student_connected',
    v_invite.teacher_id,
    v_user_name || '님이 연결되었습니다',
    '새로운 학생이 초대 코드를 사용하여 연결되었습니다.',
    jsonb_build_object('student_id', v_user_id, 'invite_id', v_invite.id)
  )
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_invite.teacher_id,
    'notification_log_id', v_notification_id
  );
END;
$$;

COMMENT ON FUNCTION public.use_invite_code IS
  '초대 코드 사용 (학생용, 삭제된 데이터 제외, 강사 알림 포함)';

-- --------------------------------------------------------------------------
-- 3. notification_logs 인덱스 (중복 조회 성능)
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notification_logs_dedup
  ON public.notification_logs (type, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_unread
  ON public.notification_logs (user_id)
  WHERE read_at IS NULL AND deleted_at IS NULL;
