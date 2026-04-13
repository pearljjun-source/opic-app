-- ============================================================================
-- 074: 메시징 시스템 (강사/원장 → 학생 공지 + 읽음 확인)
-- ============================================================================

-- ============================================================================
-- 1. ENUM
-- ============================================================================

CREATE TYPE public.message_target_type AS ENUM ('class', 'individual');

-- ============================================================================
-- 2. messages 테이블 (메시지 본문)
-- ============================================================================

CREATE TABLE public.messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  sender_id     uuid NOT NULL REFERENCES public.users(id),
  target_type   message_target_type NOT NULL,
  target_id     uuid NOT NULL,  -- class_id 또는 student user_id
  title         text,
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX idx_messages_org ON public.messages (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_sender ON public.messages (sender_id, created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. message_recipients 테이블 (팬아웃 + 읽음 확인)
-- ============================================================================

CREATE TABLE public.message_recipients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES public.users(id),
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_recipients_recipient ON public.message_recipients (recipient_id, created_at DESC);
CREATE INDEX idx_message_recipients_message ON public.message_recipients (message_id);
-- 같은 메시지에 같은 수신자 중복 방지
CREATE UNIQUE INDEX idx_message_recipients_unique ON public.message_recipients (message_id, recipient_id);

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;

-- messages: 발신자 본인만 조회
CREATE POLICY "messages_select_sender" ON public.messages
  FOR SELECT USING (
    sender_id = auth.uid()
    AND deleted_at IS NULL
  );

-- message_recipients: 수신자 본인만 조회
CREATE POLICY "message_recipients_select_recipient" ON public.message_recipients
  FOR SELECT USING (
    recipient_id = auth.uid()
  );

-- message_recipients: 수신자 본인만 읽음 업데이트
CREATE POLICY "message_recipients_update_read" ON public.message_recipients
  FOR UPDATE USING (
    recipient_id = auth.uid()
  )
  WITH CHECK (
    recipient_id = auth.uid()
  );

-- 직접 INSERT/DELETE는 RPC를 통해서만 (SECURITY DEFINER)

-- ============================================================================
-- 5. send_message RPC (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_message(
  p_target_type text,
  p_target_id   uuid,
  p_title       text DEFAULT NULL,
  p_body        text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id     uuid;
  v_org_id      uuid;
  v_role        text;
  v_message_id  uuid;
  v_recipient   record;
  v_count       int := 0;
BEGIN
  -- 1. 인증 확인
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 2. 발신자 역할 확인 (teacher 또는 owner만 발송 가능)
  SELECT om.organization_id, om.role::text
    INTO v_org_id, v_role
    FROM public.organization_members om
   WHERE om.user_id = v_user_id
     AND om.deleted_at IS NULL
   LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'ORG_NO_MEMBERSHIP');
  END IF;

  IF v_role NOT IN ('owner', 'teacher') THEN
    RETURN jsonb_build_object('error', 'PERM_NOT_TEACHER');
  END IF;

  -- 3. 본문 검증
  IF p_body IS NULL OR trim(p_body) = '' THEN
    RETURN jsonb_build_object('error', 'MSG_BODY_REQUIRED');
  END IF;

  -- 4. 대상 유형별 검증 + 메시지 INSERT
  IF p_target_type = 'class' THEN
    -- 반이 같은 조직에 속하는지 + 발신자가 반 소유자인지
    IF NOT EXISTS (
      SELECT 1 FROM public.classes c
       WHERE c.id = p_target_id
         AND c.organization_id = v_org_id
         AND (c.teacher_id = v_user_id OR v_role = 'owner')
         AND c.deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'NF_CLASS');
    END IF;

    -- 메시지 생성
    INSERT INTO public.messages (organization_id, sender_id, target_type, target_id, title, body)
    VALUES (v_org_id, v_user_id, 'class', p_target_id, p_title, trim(p_body))
    RETURNING id INTO v_message_id;

    -- 반 멤버에게 팬아웃
    FOR v_recipient IN
      SELECT cm.student_id
        FROM public.class_members cm
       WHERE cm.class_id = p_target_id
         AND cm.deleted_at IS NULL
    LOOP
      INSERT INTO public.message_recipients (message_id, recipient_id)
      VALUES (v_message_id, v_recipient.student_id);
      v_count := v_count + 1;
    END LOOP;

  ELSIF p_target_type = 'individual' THEN
    -- 개별 학생이 같은 조직에 속하는지 확인
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.user_id = p_target_id
         AND om.organization_id = v_org_id
         AND om.role = 'student'
         AND om.deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'ORG_STUDENT_NOT_IN_ORG');
    END IF;

    -- 강사인 경우: teacher_students 연결 확인
    IF v_role = 'teacher' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.teacher_student ts
         WHERE ts.teacher_id = v_user_id
           AND ts.student_id = p_target_id
           AND ts.deleted_at IS NULL
      ) THEN
        RETURN jsonb_build_object('error', 'PERM_NOT_CONNECTED');
      END IF;
    END IF;

    -- 메시지 생성
    INSERT INTO public.messages (organization_id, sender_id, target_type, target_id, title, body)
    VALUES (v_org_id, v_user_id, 'individual', p_target_id, p_title, trim(p_body))
    RETURNING id INTO v_message_id;

    -- 수신자 1명
    INSERT INTO public.message_recipients (message_id, recipient_id)
    VALUES (v_message_id, p_target_id);
    v_count := 1;

  ELSE
    RETURN jsonb_build_object('error', 'MSG_INVALID_TARGET_TYPE');
  END IF;

  -- 5. 알림 생성 (각 수신자에게)
  INSERT INTO public.notification_logs (user_id, type, title, body, data, created_by, resource_id)
  SELECT
    mr.recipient_id,
    'new_message',
    COALESCE(p_title, '새 메시지'),
    left(trim(p_body), 100),
    jsonb_build_object('message_id', v_message_id),
    v_user_id,
    v_message_id
  FROM public.message_recipients mr
  WHERE mr.message_id = v_message_id;

  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_message_id,
    'recipient_count', v_count
  );
END;
$$;

-- ============================================================================
-- 6. get_my_messages RPC (학생 수신함)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_messages(
  p_limit  int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_result  jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        m.id,
        m.title,
        m.body,
        m.target_type::text,
        m.created_at,
        mr.read_at,
        u.name AS sender_name,
        CASE m.target_type
          WHEN 'class' THEN (SELECT c.name FROM public.classes c WHERE c.id = m.target_id)
          ELSE NULL
        END AS class_name
      FROM public.message_recipients mr
      JOIN public.messages m ON m.id = mr.message_id AND m.deleted_at IS NULL
      JOIN public.users u ON u.id = m.sender_id
     WHERE mr.recipient_id = v_user_id
     ORDER BY m.created_at DESC
     LIMIT p_limit
    OFFSET p_offset
    ) t;

  RETURN jsonb_build_object('success', true, 'messages', v_result);
END;
$$;

-- ============================================================================
-- 7. get_sent_messages RPC (강사 발송 이력)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_sent_messages(
  p_limit  int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_result  jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        m.id,
        m.title,
        m.body,
        m.target_type::text,
        m.created_at,
        CASE m.target_type
          WHEN 'class' THEN (SELECT c.name FROM public.classes c WHERE c.id = m.target_id)
          ELSE (SELECT u2.name FROM public.users u2 WHERE u2.id = m.target_id)
        END AS target_name,
        (SELECT COUNT(*) FROM public.message_recipients mr WHERE mr.message_id = m.id)::int AS recipient_count,
        (SELECT COUNT(*) FROM public.message_recipients mr WHERE mr.message_id = m.id AND mr.read_at IS NOT NULL)::int AS read_count
      FROM public.messages m
     WHERE m.sender_id = v_user_id
       AND m.deleted_at IS NULL
     ORDER BY m.created_at DESC
     LIMIT p_limit
    OFFSET p_offset
    ) t;

  RETURN jsonb_build_object('success', true, 'messages', v_result);
END;
$$;

-- ============================================================================
-- 8. mark_message_read RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  UPDATE public.message_recipients
     SET read_at = now()
   WHERE message_id = p_message_id
     AND recipient_id = v_user_id
     AND read_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 9. get_unread_message_count RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_unread_message_count()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*)::int
    FROM public.message_recipients mr
    JOIN public.messages m ON m.id = mr.message_id AND m.deleted_at IS NULL
   WHERE mr.recipient_id = auth.uid()
     AND mr.read_at IS NULL;
$$;
