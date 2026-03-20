-- ============================================================================
-- 054: 반별 다회용 초대 코드 시스템
-- ============================================================================
-- 사유:
--   - 1:1 코드(한 코드 = 한 명 사용)는 학원 규모 확장 시 비효율
--   - Google Classroom/ClassDojo 벤치마킹: 반별 다회용 코드가 업계 표준
--   - 초대 코드에 반 연결 → 사용 시 자동 반 배정
-- ============================================================================

-- ============================================================================
-- 1. invites 테이블 컬럼 추가
-- ============================================================================

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id),
  ADD COLUMN IF NOT EXISTS max_uses int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS use_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.invites.class_id IS '연결된 반 ID (NULL = 반 미지정)';
COMMENT ON COLUMN public.invites.max_uses IS '최대 사용 횟수 (1 = 1회용, 0 = 무제한)';
COMMENT ON COLUMN public.invites.use_count IS '현재 사용 횟수';

-- 활성 반별 초대 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_invites_class_active
  ON public.invites(class_id)
  WHERE deleted_at IS NULL AND status = 'pending';

-- ============================================================================
-- 2. invite_uses 테이블 (다회용 코드 사용 이력)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invite_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  used_at timestamptz DEFAULT now(),
  UNIQUE(invite_id, user_id)
);

COMMENT ON TABLE public.invite_uses IS '초대 코드 사용 이력 (다회용 코드 추적)';

CREATE INDEX IF NOT EXISTS idx_invite_uses_invite ON public.invite_uses(invite_id);
CREATE INDEX IF NOT EXISTS idx_invite_uses_user ON public.invite_uses(user_id);

ALTER TABLE public.invite_uses ENABLE ROW LEVEL SECURITY;

-- 강사: 본인 초대 코드의 사용 이력 조회
CREATE POLICY "invite_uses_select_teacher" ON public.invite_uses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invites i
      WHERE i.id = invite_uses.invite_id
        AND i.teacher_id = auth.uid()
        AND i.deleted_at IS NULL
    )
  );

-- 학생: 본인 사용 이력 조회
CREATE POLICY "invite_uses_select_student" ON public.invite_uses
  FOR SELECT USING (user_id = auth.uid());

-- INSERT는 SECURITY DEFINER RPC 내부에서만 수행 (정책 불필요)

-- ============================================================================
-- 3. create_invite RPC 재작성
-- ============================================================================
-- 변경:
--   - 새 파라미터: p_class_id, p_max_uses
--   - class_id 소유권 검증 (teacher_id = auth.uid())
--   - 레거시 "자동 조직 생성" 폴백 제거 (users.role 컬럼 037에서 DROP됨)
--   - 반환값에 class_id, max_uses, class_name 추가
-- ============================================================================

-- 기존 함수 시그니처 제거 (파라미터 수 변경)
DROP FUNCTION IF EXISTS public.create_invite(int, public.org_role);

CREATE OR REPLACE FUNCTION public.create_invite(
  p_expires_in_days int DEFAULT 7,
  p_target_role public.org_role DEFAULT 'student',
  p_class_id uuid DEFAULT NULL,
  p_max_uses int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_org_role public.org_role;
  v_code text;
  v_invite_id uuid;
  v_class_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 발급자의 조직 + 역할 조회
  SELECT om.organization_id, om.role INTO v_org_id, v_org_role
  FROM public.organization_members om
  WHERE om.user_id = v_user_id AND om.role IN ('owner', 'teacher') AND om.deleted_at IS NULL
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_TEACHER');
  END IF;

  -- teacher는 student만 초대 가능, owner는 teacher도 초대 가능
  IF p_target_role = 'teacher' AND v_org_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'OWNER_ONLY');
  END IF;

  -- owner 초대는 불가 (보안 — admin 전용)
  IF p_target_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_INVITE_OWNER');
  END IF;

  -- class_id 검증
  IF p_class_id IS NOT NULL THEN
    -- 강사 초대에는 class_id 불가
    IF p_target_role = 'teacher' THEN
      RETURN jsonb_build_object('success', false, 'error', 'TEACHER_INVITE_NO_CLASS');
    END IF;

    -- 반 소유권 + 존재 확인
    SELECT c.name INTO v_class_name
    FROM public.classes c
    WHERE c.id = p_class_id
      AND c.teacher_id = v_user_id
      AND c.deleted_at IS NULL;

    IF v_class_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'CLASS_NOT_FOUND');
    END IF;
  END IF;

  -- max_uses 유효성 (0 = 무제한, 1+ = 제한)
  IF p_max_uses < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_MAX_USES');
  END IF;

  v_code := public.generate_invite_code();

  INSERT INTO public.invites (teacher_id, code, status, expires_at, organization_id, target_role, class_id, max_uses, use_count)
  VALUES (
    v_user_id,
    v_code,
    'pending',
    now() + (p_expires_in_days || ' days')::interval,
    v_org_id,
    p_target_role,
    p_class_id,
    p_max_uses,
    0
  )
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'code', v_code,
    'expires_at', (now() + (p_expires_in_days || ' days')::interval),
    'target_role', p_target_role,
    'class_id', p_class_id,
    'class_name', v_class_name,
    'max_uses', p_max_uses
  );
END;
$$;

COMMENT ON FUNCTION public.create_invite(int, public.org_role, uuid, int) IS
  '초대 코드 생성 (반 연결 + 다회용 지원)';

-- ============================================================================
-- 4. use_invite_code RPC 재작성
-- ============================================================================
-- 변경:
--   - 다회용 CAS: use_count 증가, max_uses 도달 시 status = 'used'
--   - invite_uses 이력 기록
--   - 이미 사용한 코드 재사용 방지 (ALREADY_USED_CODE)
--   - class_id 있으면 class_members 자동 추가
--   - notification resource_id: 다회용 지원 위해 별도 uuid 생성
-- ============================================================================

CREATE OR REPLACE FUNCTION public.use_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_invite record;
  v_org_id uuid;
  v_rows_affected int;
  v_notification_id uuid;
  v_notification_resource_id uuid;
  v_notification_type text;
  v_notification_title text;
  v_notification_body text;
  v_quota jsonb;
  v_class_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 초대 코드 조회 (pending + 미만료 + 미삭제)
  -- 다회용: status = 'pending'은 use_count < max_uses일 때 유지됨
  SELECT * INTO v_invite FROM public.invites
  WHERE code = upper(trim(p_code))
    AND status = 'pending'
    AND expires_at > now()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  v_org_id := v_invite.organization_id;

  -- 본인 코드 사용 불가
  IF v_invite.teacher_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_USE_OWN_CODE');
  END IF;

  -- 이미 이 코드를 사용했는지 체크 (다회용 코드 중복 사용 방지)
  IF EXISTS (
    SELECT 1 FROM public.invite_uses iu
    WHERE iu.invite_id = v_invite.id AND iu.user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_USED_CODE');
  END IF;

  -- ★ 학생 초대 시 쿼터 검증 (서버 사이드)
  IF v_invite.target_role = 'student' AND v_org_id IS NOT NULL THEN
    v_quota := public._check_org_quota(v_org_id, 'max_students');
    IF NOT (v_quota->>'allowed')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'STUDENT_QUOTA_EXCEEDED',
        'limit', (v_quota->>'limit')::int,
        'used', (v_quota->>'used')::int,
        'plan_key', v_quota->>'plan_key'
      );
    END IF;
  END IF;

  -- ====================================================================
  -- 다회용 CAS: use_count 원자적 증가 + 상태 전이
  -- max_uses = 0은 무제한 (use_count < max_uses 조건 스킵)
  -- ====================================================================
  UPDATE public.invites
  SET use_count = use_count + 1,
      status = CASE
        WHEN max_uses > 0 AND use_count + 1 >= max_uses THEN 'used'::public.invite_status
        ELSE 'pending'::public.invite_status
      END,
      used_by = COALESCE(used_by, v_user_id),
      used_at = COALESCE(used_at, now())
  WHERE id = v_invite.id
    AND status = 'pending'
    AND (max_uses = 0 OR use_count < max_uses);
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

  -- 사용 이력 기록
  INSERT INTO public.invite_uses (invite_id, user_id)
  VALUES (v_invite.id, v_user_id);

  -- ========================================
  -- OWNER: 조직 생성 + owner 멤버십
  -- ========================================
  IF v_invite.target_role = 'owner' THEN
    INSERT INTO public.organizations (name, owner_id)
    VALUES (v_invite.organization_name, v_user_id)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
    VALUES (v_org_id, v_user_id, 'owner', v_invite.teacher_id);

    UPDATE public.invites
    SET organization_id = v_org_id
    WHERE id = v_invite.id;

    v_notification_type := 'owner_invite_redeemed';
    v_notification_title := '학원 원장 등록 완료';
    v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id)
      || '님이 ' || v_invite.organization_name || ' 학원 원장으로 등록되었습니다';

  -- ========================================
  -- STUDENT/TEACHER: 조직 멤버십 + 연결
  -- ========================================
  ELSE
    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
      VALUES (v_org_id, v_user_id, v_invite.target_role, v_invite.teacher_id)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_invite.target_role = 'student' THEN
      -- teacher_student 연결
      IF v_org_id IS NOT NULL THEN
        INSERT INTO public.teacher_student (teacher_id, student_id, organization_id)
        VALUES (v_invite.teacher_id, v_user_id, v_org_id)
        ON CONFLICT DO NOTHING;
      ELSE
        INSERT INTO public.teacher_student (teacher_id, student_id, organization_id)
        SELECT v_invite.teacher_id, v_user_id, om.organization_id
        FROM public.organization_members om
        WHERE om.user_id = v_invite.teacher_id AND om.role IN ('owner', 'teacher')
          AND om.deleted_at IS NULL
        LIMIT 1
        ON CONFLICT DO NOTHING;
      END IF;

      -- class_id 있으면 반 자동 배정
      IF v_invite.class_id IS NOT NULL THEN
        -- 반이 소프트 삭제되지 않았는지 확인
        IF EXISTS (
          SELECT 1 FROM public.classes c
          WHERE c.id = v_invite.class_id AND c.deleted_at IS NULL
        ) THEN
          INSERT INTO public.class_members (class_id, student_id)
          VALUES (v_invite.class_id, v_user_id)
          ON CONFLICT (class_id, student_id) DO UPDATE SET deleted_at = NULL;

          SELECT c.name INTO v_class_name
          FROM public.classes c WHERE c.id = v_invite.class_id;
        END IF;
      END IF;

      v_notification_type := 'student_connected';
      v_notification_title := '새 학생 연결';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || ' 학생이 연결되었습니다';

    ELSIF v_invite.target_role = 'teacher' THEN
      v_notification_type := 'teacher_connected';
      v_notification_title := '새 강사 합류';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || ' 강사가 합류했습니다';

    ELSE
      v_notification_type := 'student_connected';
      v_notification_title := '새 멤버 연결';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || '님이 연결되었습니다';
    END IF;
  END IF;

  -- 알림
  -- 다회용 코드: resource_id를 invite_uses의 id로 사용해서 각 사용마다 별도 알림 생성
  v_notification_resource_id := (
    SELECT iu.id FROM public.invite_uses iu
    WHERE iu.invite_id = v_invite.id AND iu.user_id = v_user_id
  );

  INSERT INTO public.notification_logs (user_id, type, title, body, data, created_by, resource_id)
  VALUES (
    v_invite.teacher_id,
    v_notification_type,
    v_notification_title,
    v_notification_body,
    jsonb_build_object(
      'user_id', v_user_id,
      'invite_id', v_invite.id,
      'target_role', v_invite.target_role::text,
      'organization_id', v_org_id,
      'class_id', v_invite.class_id,
      'class_name', v_class_name
    ),
    v_user_id,
    v_notification_resource_id
  )
  ON CONFLICT (type, user_id, resource_id) WHERE deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_invite.teacher_id,
    'organization_id', v_org_id,
    'role', v_invite.target_role,
    'notification_log_id', v_notification_id,
    'class_id', v_invite.class_id,
    'class_name', v_class_name
  );
END;
$$;

COMMENT ON FUNCTION public.use_invite_code(text) IS
  '초대 코드 사용 (다회용 지원 + 반 자동 배정)';

-- ============================================================================
-- 5. get_invite_usage_stats RPC (초대 코드 사용 현황 조회)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_invite_usage_stats(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_invite record;
  v_users jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 초대 코드 소유권 확인
  SELECT i.id, i.max_uses, i.use_count, i.class_id
  INTO v_invite
  FROM public.invites i
  WHERE i.id = p_invite_id
    AND i.teacher_id = v_user_id
    AND i.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;

  -- 사용자 목록
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'name', u.name,
    'used_at', iu.used_at
  ) ORDER BY iu.used_at DESC), '[]'::jsonb)
  INTO v_users
  FROM public.invite_uses iu
  JOIN public.users u ON u.id = iu.user_id
  WHERE iu.invite_id = p_invite_id;

  RETURN jsonb_build_object(
    'use_count', v_invite.use_count,
    'max_uses', v_invite.max_uses,
    'users', v_users
  );
END;
$$;

COMMENT ON FUNCTION public.get_invite_usage_stats(uuid) IS
  '초대 코드 사용 현황 조회 (강사 전용)';
