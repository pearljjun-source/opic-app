-- ============================================================================
-- 075: 초대 코드 만료 없음 (영구 코드) 지원
-- ============================================================================
-- p_expires_in_days = 0 → 만료 없음 (100년 후로 설정)
-- 학원 운영 특성상 반이 존재하는 한 초대 코드도 유효해야 함
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_invite(
  p_expires_in_days int DEFAULT 0,
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
  v_expires_at timestamptz;
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
    IF p_target_role = 'teacher' THEN
      RETURN jsonb_build_object('success', false, 'error', 'TEACHER_INVITE_NO_CLASS');
    END IF;

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

  -- 만료일: 0 = 영구 (100년), 양수 = 해당 일수
  IF p_expires_in_days <= 0 THEN
    v_expires_at := now() + interval '100 years';
  ELSE
    v_expires_at := now() + (p_expires_in_days || ' days')::interval;
  END IF;

  v_code := public.generate_invite_code();

  INSERT INTO public.invites (teacher_id, code, status, expires_at, organization_id, target_role, class_id, max_uses, use_count)
  VALUES (
    v_user_id,
    v_code,
    'pending',
    v_expires_at,
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
    'expires_at', v_expires_at,
    'target_role', p_target_role,
    'class_id', p_class_id,
    'class_name', v_class_name,
    'max_uses', p_max_uses
  );
END;
$$;
