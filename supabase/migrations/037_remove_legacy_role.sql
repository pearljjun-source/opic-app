-- ============================================================================
-- 037: 레거시 users.role 컬럼 완전 제거
--
-- 근본 원인: users.role (admin/teacher/student)과 신규 시스템
-- (platform_role + organization_members.role)이 공존하면서:
--   - 스토리지 RLS가 role='admin' 체크 → super_admin 업로드 차단
--   - Shadow sync 코드가 곳곳에 산재 → 불일치 가능성
--   - 14개 RLS 정책이 get_user_role() → users.role 직접 조회
--
-- 해결: users.role 컬럼 삭제, get_user_role()가 org_members에서 역할 도출
-- 029 실패 교훈: 함수 시그니처 유지, 멀티 조직 → 최고 권한
-- ============================================================================

-- ============================================================================
-- 1. get_user_role() — 핵심 브릿지 함수 재작성
--    14개 RLS 정책이 이 함수만 호출 → 자동으로 신규 로직 적용
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS public.user_role  -- 시그니처 유지!
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = p_user_id
        AND role IN ('owner', 'teacher')
        AND deleted_at IS NULL
    ) THEN 'teacher'::public.user_role
    ELSE 'student'::public.user_role
  END;
$$;

COMMENT ON FUNCTION public.get_user_role IS
  '사용자 역할 조회 (org_members 기반: owner/teacher → teacher, 나머지 → student)';

-- ============================================================================
-- 2. handle_new_user() — INSERT에서 role 컬럼 제거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, platform_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NULL
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. protect_user_columns() — role 보호 라인 제거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_user_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER 함수 (current_user = postgres) 는 bypass
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 보호 컬럼: email, id, created_at, platform_role (role 제거됨)
  NEW.email := OLD.email;
  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;
  NEW.platform_role := OLD.platform_role;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. promote_to_teacher() — is_super_admin() 사용, users.role 제거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.promote_to_teacher(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_has_teacher_role boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- super_admin 전용
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 대상 사용자 존재 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_user_id AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- 이미 강사/원장 역할이 있는지 확인
  v_has_teacher_role := EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id AND role IN ('owner', 'teacher') AND deleted_at IS NULL
  );

  IF v_has_teacher_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_TEACHER');
  END IF;

  -- 소속 조직의 student 멤버십을 teacher로 변경
  UPDATE public.organization_members
  SET role = 'teacher', updated_at = now()
  WHERE user_id = p_user_id AND role = 'student' AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

-- ============================================================================
-- 5. create_organization() — shadow sync 제거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF p_name IS NULL OR char_length(trim(p_name)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NAME_REQUIRED');
  END IF;

  IF p_slug IS NOT NULL AND p_slug !~ '^[a-z0-9-]{3,50}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_INVALID_SLUG');
  END IF;

  IF p_slug IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = p_slug AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_SLUG_TAKEN');
  END IF;

  INSERT INTO public.organizations (name, slug, owner_id)
  VALUES (trim(p_name), p_slug, v_user_id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  -- shadow sync 제거: users.role 더 이상 업데이트하지 않음

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id
  );
END;
$$;

-- ============================================================================
-- 6. change_member_role() — shadow sync 제거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.change_member_role(p_org_id uuid, p_user_id uuid, p_new_role public.org_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_current_role public.org_role;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = v_caller_id
      AND role = 'owner' AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'OWNER_ONLY');
  END IF;

  SELECT role INTO v_current_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF v_current_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  IF p_user_id = v_caller_id AND p_new_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_DEMOTE_SELF');
  END IF;

  -- shadow sync 제거: users.role 더 이상 업데이트하지 않음

  UPDATE public.organization_members
  SET role = p_new_role, updated_at = now()
  WHERE organization_id = p_org_id AND user_id = p_user_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true, 'new_role', p_new_role);
END;
$$;

-- ============================================================================
-- 7. use_invite_code() — shadow sync 2곳 제거
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
  v_notification_type text;
  v_notification_title text;
  v_notification_body text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_invite FROM public.invites
  WHERE code = upper(trim(p_code))
    AND status = 'pending'
    AND expires_at > now()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  v_org_id := v_invite.organization_id;

  IF v_invite.teacher_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_USE_OWN_CODE');
  END IF;

  -- CAS
  UPDATE public.invites
  SET status = 'used', used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id AND status = 'pending';
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

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

    -- shadow sync 제거: users.role 더 이상 업데이트하지 않음

    v_notification_type := 'owner_invite_redeemed';
    v_notification_title := '학원 원장 등록 완료';
    v_notification_body := (SELECT name FROM public.users WHERE id = v_user_id)
      || '님이 ' || v_invite.organization_name || ' 학원 원장으로 등록되었습니다';

  -- ========================================
  -- STUDENT/TEACHER: 기존 로직
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
      -- shadow sync 제거: users.role 더 이상 업데이트하지 않음

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

-- ============================================================================
-- 8. get_student_practice_stats() — users.role 의존 제거
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_practice_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_student_practice_stats(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_teacher boolean;
  v_result jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 본인이면 바로 통과
  IF v_caller_id = p_student_id THEN
    NULL;
  ELSE
    -- 연결된 강사 또는 super_admin만 허용
    v_is_teacher := EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id
        AND student_id = p_student_id
        AND deleted_at IS NULL
    );

    IF NOT v_is_teacher AND NOT public.is_super_admin() THEN
      RETURN jsonb_build_object('error', 'UNAUTHORIZED');
    END IF;
  END IF;

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
  '학생 연습 통계 (본인/연결 강사/super_admin — org_members 기반)';

-- ============================================================================
-- 9. get_student_topics_with_progress() — is_admin 체크를 is_super_admin()으로
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_topics_with_progress(uuid);

CREATE OR REPLACE FUNCTION public.get_student_topics_with_progress(p_student_id uuid)
RETURNS TABLE (
  topic_id uuid,
  topic_name_ko text,
  topic_name_en text,
  topic_icon text,
  topic_sort_order integer,
  topic_category text,
  total_questions bigint,
  scripts_count bigint,
  practices_count bigint,
  best_avg_score numeric,
  last_practice_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  v_is_authorized := (v_caller_id = p_student_id)
    OR EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
    )
    OR public.is_super_admin();

  IF NOT v_is_authorized THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id AS topic_id,
    t.name_ko AS topic_name_ko,
    t.name_en AS topic_name_en,
    t.icon AS topic_icon,
    t.sort_order AS topic_sort_order,
    t.category AS topic_category,
    (SELECT COUNT(*) FROM public.questions q WHERE q.topic_id = t.id AND q.is_active = true) AS total_questions,
    (SELECT COUNT(*) FROM public.scripts s
     JOIN public.questions q2 ON q2.id = s.question_id
     WHERE s.student_id = p_student_id AND q2.topic_id = t.id
       AND s.deleted_at IS NULL AND s.status = 'complete') AS scripts_count,
    (SELECT COUNT(*) FROM public.practices p
     JOIN public.scripts s2 ON s2.id = p.script_id
     JOIN public.questions q3 ON q3.id = s2.question_id
     WHERE p.student_id = p_student_id AND q3.topic_id = t.id
       AND p.deleted_at IS NULL AND s2.deleted_at IS NULL) AS practices_count,
    (SELECT ROUND(AVG(p2.score)::numeric, 1) FROM public.practices p2
     JOIN public.scripts s3 ON s3.id = p2.script_id
     JOIN public.questions q4 ON q4.id = s3.question_id
     WHERE p2.student_id = p_student_id AND q4.topic_id = t.id
       AND p2.deleted_at IS NULL AND s3.deleted_at IS NULL
       AND p2.score IS NOT NULL) AS best_avg_score,
    (SELECT MAX(p3.created_at) FROM public.practices p3
     JOIN public.scripts s4 ON s4.id = p3.script_id
     JOIN public.questions q5 ON q5.id = s4.question_id
     WHERE p3.student_id = p_student_id AND q5.topic_id = t.id
       AND p3.deleted_at IS NULL AND s4.deleted_at IS NULL) AS last_practice_at
  FROM public.topics t
  JOIN public.student_topics st ON st.topic_id = t.id AND st.student_id = p_student_id
  WHERE t.is_active = true
  ORDER BY t.sort_order;
END;
$$;

COMMENT ON FUNCTION public.get_student_topics_with_progress IS
  '학생 토픽별 진도 (본인/연결 강사/super_admin — org_members 기반)';

-- ============================================================================
-- 10. get_admin_dashboard_stats() — role 기반 집계를 org_members 기반으로
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_result jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'total_users', (SELECT COUNT(*) FROM public.users WHERE deleted_at IS NULL),
    'total_teachers', (
      SELECT COUNT(DISTINCT om.user_id) FROM public.organization_members om
      WHERE om.role IN ('owner', 'teacher') AND om.deleted_at IS NULL
    ),
    'total_students', (
      SELECT COUNT(DISTINCT om.user_id) FROM public.organization_members om
      WHERE om.role = 'student' AND om.deleted_at IS NULL
    ),
    'total_practices', (SELECT COUNT(*) FROM public.practices WHERE deleted_at IS NULL),
    'total_scripts', (SELECT COUNT(*) FROM public.scripts WHERE deleted_at IS NULL),
    'active_users_7d', (
      SELECT COUNT(DISTINCT student_id) FROM public.practices
      WHERE created_at > now() - INTERVAL '7 days' AND deleted_at IS NULL
    ),
    'active_users_30d', (
      SELECT COUNT(DISTINCT student_id) FROM public.practices
      WHERE created_at > now() - INTERVAL '30 days' AND deleted_at IS NULL
    ),
    'total_subscribers', (
      SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active'
    ),
    'mrr', (
      SELECT COALESCE(SUM(sp.price_monthly), 0)
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.status = 'active'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 11. admin_list_users() — legacy_role 제거, effective_role 폴백 수정
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_role text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_users jsonb;
  v_total int;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  WITH user_effective AS (
    SELECT
      u.id,
      u.email,
      u.name,
      u.platform_role,
      u.created_at,
      u.push_token,
      (
        SELECT om.role::text
        FROM public.organization_members om
        WHERE om.user_id = u.id AND om.deleted_at IS NULL
        ORDER BY
          CASE om.role
            WHEN 'owner' THEN 1
            WHEN 'teacher' THEN 2
            WHEN 'student' THEN 3
          END
        LIMIT 1
      ) AS org_role,
      (
        SELECT o.name
        FROM public.organization_members om
        JOIN public.organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
        WHERE om.user_id = u.id AND om.deleted_at IS NULL
        ORDER BY
          CASE om.role
            WHEN 'owner' THEN 1
            WHEN 'teacher' THEN 2
            WHEN 'student' THEN 3
          END
        LIMIT 1
      ) AS org_name,
      CASE
        WHEN u.platform_role = 'super_admin' THEN 'super_admin'
        WHEN EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.user_id = u.id AND om.role = 'owner' AND om.deleted_at IS NULL
        ) THEN 'owner'
        WHEN EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.user_id = u.id AND om.role = 'teacher' AND om.deleted_at IS NULL
        ) THEN 'teacher'
        ELSE 'student'
      END AS effective_role
    FROM public.users u
    WHERE u.deleted_at IS NULL
  )
  SELECT COUNT(*) INTO v_total
  FROM user_effective ue
  WHERE (p_role IS NULL OR ue.effective_role = p_role)
    AND (p_search IS NULL OR ue.name ILIKE '%' || p_search || '%' OR ue.email ILIKE '%' || p_search || '%');

  WITH user_effective AS (
    SELECT
      u.id,
      u.email,
      u.name,
      u.platform_role,
      u.created_at,
      u.push_token,
      (
        SELECT om.role::text
        FROM public.organization_members om
        WHERE om.user_id = u.id AND om.deleted_at IS NULL
        ORDER BY
          CASE om.role
            WHEN 'owner' THEN 1
            WHEN 'teacher' THEN 2
            WHEN 'student' THEN 3
          END
        LIMIT 1
      ) AS org_role,
      (
        SELECT o.name
        FROM public.organization_members om
        JOIN public.organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
        WHERE om.user_id = u.id AND om.deleted_at IS NULL
        ORDER BY
          CASE om.role
            WHEN 'owner' THEN 1
            WHEN 'teacher' THEN 2
            WHEN 'student' THEN 3
          END
        LIMIT 1
      ) AS org_name,
      CASE
        WHEN u.platform_role = 'super_admin' THEN 'super_admin'
        WHEN EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.user_id = u.id AND om.role = 'owner' AND om.deleted_at IS NULL
        ) THEN 'owner'
        WHEN EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.user_id = u.id AND om.role = 'teacher' AND om.deleted_at IS NULL
        ) THEN 'teacher'
        ELSE 'student'
      END AS effective_role
    FROM public.users u
    WHERE u.deleted_at IS NULL
  )
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_users
  FROM (
    SELECT jsonb_build_object(
      'id', ue.id,
      'email', ue.email,
      'name', ue.name,
      'role', ue.effective_role,
      'org_role', ue.org_role,
      'org_name', ue.org_name,
      'created_at', ue.created_at,
      'push_token', CASE WHEN ue.push_token IS NOT NULL THEN true ELSE false END,
      'subscription_plan', sp.name,
      'subscription_status', s.status
    ) AS row_data
    FROM user_effective ue
    LEFT JOIN public.subscriptions s
      ON (s.user_id = ue.id OR s.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.user_id = ue.id AND om.deleted_at IS NULL
      ))
      AND s.status IN ('active', 'trialing', 'past_due')
    LEFT JOIN public.subscription_plans sp
      ON sp.id = s.plan_id
    WHERE (p_role IS NULL OR ue.effective_role = p_role)
      AND (p_search IS NULL OR ue.name ILIKE '%' || p_search || '%' OR ue.email ILIKE '%' || p_search || '%')
    ORDER BY ue.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object('success', true, 'users', v_users, 'total', v_total);
END;
$$;

-- ============================================================================
-- 12. admin_get_user_by_id() — u.role 제거, effective_role 수정
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_user_by_id(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN');
  END IF;

  SELECT jsonb_build_object(
    'id', u.id,
    'name', u.name,
    'email', u.email,
    'platform_role', u.platform_role,
    'effective_role', CASE
      WHEN u.platform_role = 'super_admin' THEN 'super_admin'
      WHEN EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = u.id AND om.role = 'owner' AND om.deleted_at IS NULL
      ) THEN 'owner'
      WHEN EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = u.id AND om.role = 'teacher' AND om.deleted_at IS NULL
      ) THEN 'teacher'
      ELSE 'student'
    END,
    'created_at', u.created_at,
    'organizations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'org_id', o.id,
        'org_name', o.name,
        'org_role', om.role
      ))
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = u.id AND om.deleted_at IS NULL AND o.deleted_at IS NULL
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.users u
  WHERE u.id = p_user_id AND u.deleted_at IS NULL;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'USER_NOT_FOUND');
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 13. admin_change_user_role() — org membership 변경으로 전환
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_change_user_role(
  p_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_old_effective text;
  v_rows_affected int;
  v_prev_hash text;
  v_content text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_user_id AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF p_user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_CHANGE_OWN_ROLE');
  END IF;

  IF p_new_role NOT IN ('teacher', 'student') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ROLE');
  END IF;

  -- 현재 effective_role 계산
  SELECT CASE
    WHEN u.platform_role = 'super_admin' THEN 'super_admin'
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = u.id AND om.role = 'owner' AND om.deleted_at IS NULL
    ) THEN 'owner'
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = u.id AND om.role = 'teacher' AND om.deleted_at IS NULL
    ) THEN 'teacher'
    ELSE 'student'
  END INTO v_old_effective
  FROM public.users u WHERE u.id = p_user_id;

  -- super_admin/owner는 이 RPC로 변경 불가
  IF v_old_effective IN ('super_admin', 'owner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_CHANGE_PROTECTED_ROLE');
  END IF;

  -- org membership 역할 변경 (owner 제외)
  UPDATE public.organization_members
  SET role = p_new_role::public.org_role, updated_at = now()
  WHERE user_id = p_user_id
    AND role != 'owner'
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- Audit log
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log
  ORDER BY created_at DESC LIMIT 1;

  v_content := 'user_role_change|' || p_user_id::text || '|' || v_old_effective || '|' || p_new_role || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, resource_id, old_value, new_value, content_hash, previous_hash)
  VALUES (
    v_caller_id,
    'user_role_change',
    'user',
    p_user_id,
    jsonb_build_object('role', v_old_effective),
    jsonb_build_object('role', p_new_role),
    encode(extensions.digest(v_content, 'sha256'), 'hex'),
    v_prev_hash
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'old_role', v_old_effective, 'new_role', p_new_role);
END;
$$;

-- ============================================================================
-- 14. get_student_detail() — v_student.role 참조 제거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_detail(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
  v_student record;
  v_stats jsonb;
  v_notes text;
  v_target_grade text;
BEGIN
  v_teacher_id := auth.uid();

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT ts.notes, ts.target_opic_grade
  INTO v_notes, v_target_grade
  FROM public.teacher_student ts
  WHERE ts.teacher_id = v_teacher_id
    AND ts.student_id = p_student_id
    AND ts.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  SELECT * INTO v_student
  FROM public.users
  WHERE id = p_student_id
    AND deleted_at IS NULL;

  IF v_student IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND');
  END IF;

  SELECT jsonb_build_object(
    'scripts_count', COALESCE(
      (SELECT COUNT(*)
       FROM public.scripts s
       WHERE s.student_id = p_student_id
         AND s.teacher_id = v_teacher_id
         AND s.deleted_at IS NULL),
      0
    ),
    'practices_count', COALESCE(
      (SELECT COUNT(*)
       FROM public.practices p
       INNER JOIN public.scripts s ON s.id = p.script_id
       WHERE p.student_id = p_student_id
         AND s.teacher_id = v_teacher_id
         AND p.deleted_at IS NULL
         AND s.deleted_at IS NULL),
      0
    ),
    'total_duration_minutes', COALESCE(
      (SELECT SUM(p.duration) / 60
       FROM public.practices p
       INNER JOIN public.scripts s ON s.id = p.script_id
       WHERE p.student_id = p_student_id
         AND s.teacher_id = v_teacher_id
         AND p.deleted_at IS NULL
         AND s.deleted_at IS NULL),
      0
    ),
    'avg_score', (
      SELECT ROUND(AVG(p.score)::numeric, 1)
      FROM public.practices p
      INNER JOIN public.scripts s ON s.id = p.script_id
      WHERE p.student_id = p_student_id
        AND s.teacher_id = v_teacher_id
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND p.score IS NOT NULL
    ),
    'avg_reproduction_rate', (
      SELECT ROUND(AVG(p.reproduction_rate)::numeric, 1)
      FROM public.practices p
      INNER JOIN public.scripts s ON s.id = p.script_id
      WHERE p.student_id = p_student_id
        AND s.teacher_id = v_teacher_id
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND p.reproduction_rate IS NOT NULL
    ),
    'last_practice_at', (
      SELECT MAX(p.created_at)
      FROM public.practices p
      INNER JOIN public.scripts s ON s.id = p.script_id
      WHERE p.student_id = p_student_id
        AND s.teacher_id = v_teacher_id
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
    ),
    'this_week_practices', COALESCE(
      (SELECT COUNT(*)
       FROM public.practices p
       INNER JOIN public.scripts s ON s.id = p.script_id
       WHERE p.student_id = p_student_id
         AND s.teacher_id = v_teacher_id
         AND p.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND p.created_at > now() - interval '7 days'),
      0
    ),
    'connected_at', (
      SELECT ts.created_at
      FROM public.teacher_student ts
      WHERE ts.teacher_id = v_teacher_id
        AND ts.student_id = p_student_id
        AND ts.deleted_at IS NULL
    ),
    'notes', v_notes,
    'target_opic_grade', v_target_grade
  ) INTO v_stats;

  RETURN jsonb_build_object(
    'success', true,
    'student', jsonb_build_object(
      'id', v_student.id,
      'email', v_student.email,
      'name', v_student.name,
      'created_at', v_student.created_at
    ),
    'stats', v_stats
  );
END;
$$;

COMMENT ON FUNCTION public.get_student_detail IS
  '학생 상세 정보 조회 (기본 정보 + 통계 + 메모 + 목표등급, role 제거됨)';

-- ============================================================================
-- 15. 스토리지 정책 — is_super_admin() 사용 (idempotent)
-- ============================================================================

DROP POLICY IF EXISTS "landing_assets_admin_upload" ON storage.objects;
CREATE POLICY "landing_assets_admin_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'landing-assets'
    AND public.is_super_admin()
  );

DROP POLICY IF EXISTS "landing_assets_admin_delete" ON storage.objects;
CREATE POLICY "landing_assets_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'landing-assets'
    AND public.is_super_admin()
  );

-- ============================================================================
-- 15.5. role 컬럼 의존 객체 제거 (017에서 생성, 024 미적용 시 잔존)
-- ============================================================================

-- 트리거: BEFORE UPDATE OF role → role 컬럼 직접 의존
DROP TRIGGER IF EXISTS check_role_transition ON public.users;
DROP FUNCTION IF EXISTS public.validate_role_transition();

-- 6개 RLS 정책: role = 'admin' → is_super_admin() 전환
DROP POLICY IF EXISTS "landing_sections_admin_all" ON public.landing_sections;
CREATE POLICY "landing_sections_admin_all" ON public.landing_sections
  FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS "landing_items_admin_all" ON public.landing_items;
CREATE POLICY "landing_items_admin_all" ON public.landing_items
  FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS "plans_admin_all" ON public.subscription_plans;
CREATE POLICY "plans_admin_all" ON public.subscription_plans
  FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS "subscriptions_admin_all" ON public.subscriptions;
CREATE POLICY "subscriptions_admin_all" ON public.subscriptions
  FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS "payments_admin_read" ON public.payment_history;
CREATE POLICY "payments_admin_read" ON public.payment_history
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS "audit_admin_read" ON public.admin_audit_log;
CREATE POLICY "audit_admin_read" ON public.admin_audit_log
  FOR SELECT USING (public.is_super_admin());

-- ============================================================================
-- 16. 컬럼 삭제
-- ============================================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS role;

-- user_role ENUM 타입은 유지 (get_user_role 반환 타입으로 사용)
