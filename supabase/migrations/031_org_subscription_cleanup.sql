-- ============================================================================
-- 031: 조직 기반 구독 정비 — backfill + RLS + entitlement RPC
--
-- 근본 원인: 017(개인 구독)과 020(조직 구독)이 혼재
-- - billing-key가 organization_id 없이 구독 생성
-- - RLS가 user_id만 체크 → org 멤버가 구독 조회 불가
-- - entitlement 체크 RPC 부재 → feature gating 연결 불가
--
-- 수정:
-- 1. 기존 subscriptions.organization_id NULL → backfill
-- 2. subscriptions + payment_history RLS 추가 (org 기반)
-- 3. check_org_entitlement() RPC (서버 사이드 feature gating)
-- 4. use_invite_code() OWNER 분기에 free 구독 자동 생성
-- ============================================================================

-- ============================================================================
-- 1. BACKFILL: subscriptions.organization_id
-- ============================================================================
-- org_members에서 owner의 org_id 조회 → subscription에 매핑
-- 020에서도 동일 작업을 했지만, billing-key가 org_id 없이 생성한 구독이 있을 수 있음

UPDATE public.subscriptions sub
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE sub.user_id = om.user_id
  AND om.role = 'owner'
  AND om.deleted_at IS NULL
  AND sub.organization_id IS NULL;

-- ============================================================================
-- 2. RLS 정책 추가
-- ============================================================================

-- 2-1. org 멤버가 소속 org의 구독 조회 가능
-- 기존 subscriptions_own_read (user_id = auth.uid())는 유지 (하위 호환)
CREATE POLICY "subscriptions_org_read" ON public.subscriptions
  FOR SELECT USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = subscriptions.organization_id
        AND om.user_id = auth.uid()
        AND om.deleted_at IS NULL
    )
  );

-- 2-2. org owner가 결제 이력 조회 가능
-- 기존 payments_own_read (user_id = auth.uid())는 유지
CREATE POLICY "payments_org_owner_read" ON public.payment_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.organization_members om
        ON om.organization_id = s.organization_id
      WHERE s.id = payment_history.subscription_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
        AND om.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 3. check_org_entitlement() RPC
-- ============================================================================
-- feature gating의 핵심: 서버에서 auth.uid()만으로 entitlement 결정
-- 클라이언트가 orgId를 전달할 필요 없음
--
-- 로직:
-- 1. auth.uid() → org_members → 가장 높은 권한의 org
-- 2. org → subscriptions (active/trialing/past_due)
-- 3. subscription → plan → feature 체크
-- 4. 구독 없는 org → free 기본값
-- 5. org 미가입 → free 기본값

CREATE OR REPLACE FUNCTION public.check_org_entitlement(p_feature_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_sub record;
  v_plan record;
  v_used int;
  -- Free tier 기본값
  c_free_students constant int := 3;
  c_free_scripts constant int := 5;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 1. 사용자의 가장 높은 권한 org 조회
  SELECT om.organization_id INTO v_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id AND om.deleted_at IS NULL
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 1
      WHEN 'teacher' THEN 2
      WHEN 'student' THEN 3
    END
  LIMIT 1;

  -- org 미가입 → free 기본값 반환
  IF v_org_id IS NULL THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, NULL);
  END IF;

  -- 2. org의 활성 구독 조회
  SELECT s.id, s.status, s.plan_id
  INTO v_sub
  FROM public.subscriptions s
  WHERE s.organization_id = v_org_id
    AND s.status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  -- 구독 없음 → free 기본값
  IF NOT FOUND THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, v_org_id);
  END IF;

  -- 3. 플랜 조회
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  IF NOT FOUND THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, v_org_id);
  END IF;

  -- 4. feature별 entitlement 체크
  IF p_feature_key = 'ai_feedback' THEN
    RETURN jsonb_build_object(
      'allowed', v_plan.ai_feedback_enabled,
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id
    );

  ELSIF p_feature_key = 'tts' THEN
    RETURN jsonb_build_object(
      'allowed', v_plan.tts_enabled,
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id
    );

  ELSIF p_feature_key = 'max_students' THEN
    SELECT COUNT(*) INTO v_used
    FROM public.organization_members
    WHERE organization_id = v_org_id
      AND role = 'student'
      AND deleted_at IS NULL;

    RETURN jsonb_build_object(
      'allowed', v_used < v_plan.max_students,
      'limit', v_plan.max_students,
      'used', v_used,
      'remaining', GREATEST(0, v_plan.max_students - v_used),
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id
    );

  ELSIF p_feature_key = 'max_scripts' THEN
    SELECT COUNT(*) INTO v_used
    FROM public.scripts
    WHERE organization_id = v_org_id
      AND deleted_at IS NULL;

    RETURN jsonb_build_object(
      'allowed', v_used < v_plan.max_scripts,
      'limit', v_plan.max_scripts,
      'used', v_used,
      'remaining', GREATEST(0, v_plan.max_scripts - v_used),
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id
    );

  ELSE
    RETURN jsonb_build_object('error', 'UNKNOWN_FEATURE', 'feature_key', p_feature_key);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.check_org_entitlement IS
  'Feature gating 핵심 RPC: auth.uid() → org → subscription → plan → feature 체크. 구독/org 없으면 free 기본값.';

-- ============================================================================
-- 3-1. _entitlement_free_default — free tier 기본값 헬퍼
-- ============================================================================

CREATE OR REPLACE FUNCTION public._entitlement_free_default(
  p_feature_key text,
  p_user_id uuid,
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_used int;
  c_free_students constant int := 3;
  c_free_scripts constant int := 5;
BEGIN
  IF p_feature_key = 'ai_feedback' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
    );

  ELSIF p_feature_key = 'tts' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
    );

  ELSIF p_feature_key = 'max_students' THEN
    IF p_org_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used
      FROM public.organization_members
      WHERE organization_id = p_org_id
        AND role = 'student'
        AND deleted_at IS NULL;
    ELSE
      -- org 미가입: teacher_student 기반 카운트 (레거시)
      SELECT COUNT(*) INTO v_used
      FROM public.teacher_student
      WHERE teacher_id = p_user_id
        AND deleted_at IS NULL;
    END IF;

    RETURN jsonb_build_object(
      'allowed', v_used < c_free_students,
      'limit', c_free_students,
      'used', v_used,
      'remaining', GREATEST(0, c_free_students - v_used),
      'plan_key', 'free',
      'org_id', p_org_id
    );

  ELSIF p_feature_key = 'max_scripts' THEN
    IF p_org_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used
      FROM public.scripts
      WHERE organization_id = p_org_id
        AND deleted_at IS NULL;
    ELSE
      SELECT COUNT(*) INTO v_used
      FROM public.scripts
      WHERE teacher_id = p_user_id
        AND deleted_at IS NULL;
    END IF;

    RETURN jsonb_build_object(
      'allowed', v_used < c_free_scripts,
      'limit', c_free_scripts,
      'used', v_used,
      'remaining', GREATEST(0, c_free_scripts - v_used),
      'plan_key', 'free',
      'org_id', p_org_id
    );

  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'UNKNOWN_FEATURE'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public._entitlement_free_default IS
  'Free tier 기본값 헬퍼 (check_org_entitlement 내부 사용)';

-- ============================================================================
-- 4. use_invite_code() — OWNER 분기에 free 구독 자동 생성 추가
-- ============================================================================
-- 030에서 복원한 use_invite_code에 free 구독 INSERT 추가
-- 기존 로직은 그대로, OWNER 분기의 org 생성 직후에 추가

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
  v_notification_type text;
  v_notification_title text;
  v_notification_body text;
  v_free_plan_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 1. 코드 조회
  SELECT * INTO v_invite FROM public.invites
  WHERE code = upper(trim(p_code))
    AND status = 'pending'
    AND expires_at > now()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  v_org_id := v_invite.organization_id;

  -- 자기 자신의 코드는 사용 불가
  IF v_invite.teacher_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_USE_OWN_CODE');
  END IF;

  -- 2. CAS: 코드 사용 처리
  UPDATE public.invites
  SET status = 'used', used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id AND status = 'pending';
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

  -- ========================================
  -- 3. OWNER: 조직 생성 + owner 멤버십
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

    -- users.role → teacher (하위 호환: owner = teacher superset)
    UPDATE public.users SET role = 'teacher'
    WHERE id = v_user_id AND role = 'student' AND deleted_at IS NULL;

    -- ★ 신규: free 구독 자동 생성
    SELECT id INTO v_free_plan_id
    FROM public.subscription_plans
    WHERE plan_key = 'free' AND is_active = true
    LIMIT 1;

    IF v_free_plan_id IS NOT NULL THEN
      INSERT INTO public.subscriptions (
        user_id, organization_id, plan_id, status,
        billing_provider, current_period_start, current_period_end
      )
      VALUES (
        v_user_id, v_org_id, v_free_plan_id, 'active',
        'toss', now(), now() + interval '100 years'
      )
      ON CONFLICT DO NOTHING;
    END IF;

    v_notification_type := 'owner_invite_redeemed';
    v_notification_title := '학원 원장 등록 완료';
    v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id)
      || '님이 ' || v_invite.organization_name || ' 학원 원장으로 등록되었습니다';

  -- ========================================
  -- 3-alt. STUDENT/TEACHER: 기존 로직
  -- ========================================
  ELSE
    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
      VALUES (v_org_id, v_user_id, v_invite.target_role, v_invite.teacher_id)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_invite.target_role = 'student' THEN
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

      v_notification_type := 'student_connected';
      v_notification_title := '새 학생 연결';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || ' 학생이 연결되었습니다';

    ELSIF v_invite.target_role = 'teacher' THEN
      UPDATE public.users SET role = 'teacher'
      WHERE id = v_user_id AND role = 'student' AND deleted_at IS NULL;

      v_notification_type := 'teacher_connected';
      v_notification_title := '새 강사 합류';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || ' 강사가 합류했습니다';

    ELSE
      v_notification_type := 'student_connected';
      v_notification_title := '새 멤버 연결';
      v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id) || '님이 연결되었습니다';
    END IF;
  END IF;

  -- 5. 알림
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
      'organization_id', v_org_id
    ),
    v_user_id,
    v_invite.id
  )
  ON CONFLICT (type, user_id, resource_id) WHERE deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_invite.teacher_id,
    'organization_id', v_org_id,
    'role', v_invite.target_role,
    'notification_log_id', v_notification_id
  );
END;
$$;

COMMENT ON FUNCTION public.use_invite_code IS
  '초대 코드 사용 (030 복원 + 031 추가: OWNER 분기에서 free 구독 자동 생성)';

-- ============================================================================
-- 5. 기존 org에 free 구독 backfill (구독 없는 org)
-- ============================================================================
-- use_invite_code가 이미 실행된 org들 중 구독이 없는 경우

INSERT INTO public.subscriptions (
  user_id, organization_id, plan_id, status,
  billing_provider, current_period_start, current_period_end
)
SELECT
  o.owner_id,
  o.id,
  sp.id,
  'active',
  'toss',
  now(),
  now() + interval '100 years'
FROM public.organizations o
CROSS JOIN public.subscription_plans sp
WHERE sp.plan_key = 'free'
  AND sp.is_active = true
  AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.organization_id = o.id
      AND s.status IN ('active', 'trialing', 'past_due')
  )
ON CONFLICT DO NOTHING;
