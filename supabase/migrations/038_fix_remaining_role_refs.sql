-- ============================================================================
-- 038: users.role 참조 잔존 함수 핫픽스
--
-- 037에서 role 컬럼 삭제 시 누락된 7개 함수 수정
-- (024 마이그레이션이 production에 미적용 → 017 버전이 잔존)
-- ============================================================================

-- ============================================================================
-- 1. admin_update_landing_section — role 체크 → is_super_admin()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_landing_section(
  p_section_key text,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_section_id uuid;
  v_old_values jsonb;
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

  SELECT id, jsonb_build_object('title', title, 'subtitle', subtitle, 'content', content, 'is_active', is_active)
  INTO v_section_id, v_old_values
  FROM public.landing_sections
  WHERE section_key = p_section_key AND deleted_at IS NULL;

  IF v_section_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SECTION_NOT_FOUND');
  END IF;

  UPDATE public.landing_sections SET
    title = COALESCE(p_updates->>'title', title),
    subtitle = COALESCE(p_updates->>'subtitle', subtitle),
    content = COALESCE(p_updates->'content', content),
    is_active = COALESCE((p_updates->>'is_active')::boolean, is_active),
    updated_at = now()
  WHERE id = v_section_id;

  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 1;

  v_content := 'landing_update|' || v_section_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, resource_id, old_value, new_value, content_hash, previous_hash)
  VALUES (v_caller_id, 'landing_update', 'landing_section', v_section_id, v_old_values, p_updates, encode(extensions.digest(v_content, 'sha256'), 'hex'), v_prev_hash);

  RETURN jsonb_build_object('success', true, 'section_id', v_section_id);
END;
$$;

-- ============================================================================
-- 2. admin_upsert_landing_item — role 체크 → is_super_admin()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_upsert_landing_item(p_item jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_item_id uuid;
  v_section_id uuid;
  v_is_new boolean := false;
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

  v_item_id := (p_item->>'id')::uuid;
  v_section_id := (p_item->>'section_id')::uuid;

  IF NOT EXISTS (SELECT 1 FROM public.landing_sections WHERE id = v_section_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SECTION_NOT_FOUND');
  END IF;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.landing_items SET
      title = COALESCE(p_item->>'title', title),
      description = COALESCE(p_item->>'description', description),
      icon = COALESCE(p_item->>'icon', icon),
      image_url = COALESCE(p_item->>'image_url', image_url),
      video_url = COALESCE(p_item->>'video_url', video_url),
      metadata = COALESCE(p_item->'metadata', metadata),
      sort_order = COALESCE((p_item->>'sort_order')::int, sort_order),
      is_active = COALESCE((p_item->>'is_active')::boolean, is_active),
      updated_at = now()
    WHERE id = v_item_id AND deleted_at IS NULL;
  ELSE
    v_is_new := true;
    INSERT INTO public.landing_items (section_id, title, description, icon, image_url, video_url, metadata, sort_order, is_active)
    VALUES (
      v_section_id,
      p_item->>'title',
      p_item->>'description',
      p_item->>'icon',
      p_item->>'image_url',
      p_item->>'video_url',
      p_item->'metadata',
      COALESCE((p_item->>'sort_order')::int, 0),
      COALESCE((p_item->>'is_active')::boolean, true)
    )
    RETURNING id INTO v_item_id;
  END IF;

  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 1;

  v_content := CASE WHEN v_is_new THEN 'landing_item_create' ELSE 'landing_update' END || '|' || v_item_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, resource_id, new_value, content_hash, previous_hash)
  VALUES (
    v_caller_id,
    CASE WHEN v_is_new THEN 'landing_item_create' ELSE 'landing_update' END,
    'landing_item',
    v_item_id,
    p_item,
    encode(extensions.digest(v_content, 'sha256'), 'hex'),
    v_prev_hash
  );

  RETURN jsonb_build_object('success', true, 'item_id', v_item_id, 'is_new', v_is_new);
END;
$$;

-- ============================================================================
-- 3. admin_delete_landing_item — role 체크 → is_super_admin()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_landing_item(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
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

  UPDATE public.landing_items
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ITEM_NOT_FOUND');
  END IF;

  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 1;

  v_content := 'landing_item_delete|' || p_item_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, resource_id, content_hash, previous_hash)
  VALUES (v_caller_id, 'landing_item_delete', 'landing_item', p_item_id, encode(extensions.digest(v_content, 'sha256'), 'hex'), v_prev_hash);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 4. admin_reorder_items — role 체크 → is_super_admin()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_reorder_items(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_item jsonb;
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.landing_items
    SET sort_order = (v_item->>'sort_order')::int, updated_at = now()
    WHERE id = (v_item->>'id')::uuid AND deleted_at IS NULL;
  END LOOP;

  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 1;

  v_content := 'landing_reorder|' || p_items::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, new_value, content_hash, previous_hash)
  VALUES (v_caller_id, 'landing_reorder', 'landing_item', p_items, encode(extensions.digest(v_content, 'sha256'), 'hex'), v_prev_hash);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 5. admin_get_subscription_stats — role 체크 → is_super_admin()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_subscription_stats()
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
    'total_active', (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active'),
    'total_past_due', (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'past_due'),
    'total_canceled', (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'canceled'),
    'mrr', (
      SELECT COALESCE(SUM(sp.price_monthly), 0)
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.status = 'active'
    ),
    'plans_distribution', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'plan_key', sp.plan_key,
        'plan_name', sp.name,
        'count', sub.cnt
      )), '[]'::jsonb)
      FROM (
        SELECT plan_id, COUNT(*) AS cnt
        FROM public.subscriptions WHERE status = 'active'
        GROUP BY plan_id
      ) sub
      JOIN public.subscription_plans sp ON sp.id = sub.plan_id
    ),
    'revenue_30d', (
      SELECT COALESCE(SUM(amount), 0) FROM public.payment_history
      WHERE status = 'paid' AND paid_at > now() - INTERVAL '30 days'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 6. admin_update_plan — role 체크 → is_super_admin()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_plan(
  p_plan_id uuid,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_old_values jsonb;
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

  SELECT jsonb_build_object(
    'name', name, 'price_monthly', price_monthly, 'price_yearly', price_yearly,
    'max_students', max_students, 'max_scripts', max_scripts,
    'ai_feedback_enabled', ai_feedback_enabled, 'tts_enabled', tts_enabled,
    'features', features, 'is_active', is_active
  )
  INTO v_old_values
  FROM public.subscription_plans WHERE id = p_plan_id;

  IF v_old_values IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PLAN_NOT_FOUND');
  END IF;

  UPDATE public.subscription_plans SET
    name = COALESCE(p_updates->>'name', name),
    price_monthly = COALESCE((p_updates->>'price_monthly')::int, price_monthly),
    price_yearly = COALESCE((p_updates->>'price_yearly')::int, price_yearly),
    max_students = COALESCE((p_updates->>'max_students')::int, max_students),
    max_scripts = COALESCE((p_updates->>'max_scripts')::int, max_scripts),
    ai_feedback_enabled = COALESCE((p_updates->>'ai_feedback_enabled')::boolean, ai_feedback_enabled),
    tts_enabled = COALESCE((p_updates->>'tts_enabled')::boolean, tts_enabled),
    features = COALESCE(p_updates->'features', features),
    is_active = COALESCE((p_updates->>'is_active')::boolean, is_active),
    updated_at = now()
  WHERE id = p_plan_id;

  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 1;

  v_content := 'plan_update|' || p_plan_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, resource_id, old_value, new_value, content_hash, previous_hash)
  VALUES (v_caller_id, 'plan_update', 'plan', p_plan_id, v_old_values, p_updates, encode(extensions.digest(v_content, 'sha256'), 'hex'), v_prev_hash);

  RETURN jsonb_build_object('success', true, 'plan_id', p_plan_id);
END;
$$;

-- ============================================================================
-- 7. get_topic_questions_with_scripts — role 기반 인가 → 관계 기반 인가
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_topic_questions_with_scripts(
  p_student_id uuid,
  p_topic_id uuid
)
RETURNS TABLE (
  question_id uuid,
  question_text text,
  question_type public.question_type,
  difficulty integer,
  hint_ko text,
  audio_url text,
  sort_order integer,
  script_id uuid,
  script_content text,
  script_status public.script_status,
  script_created_at timestamptz,
  practices_count bigint,
  last_practice_at timestamptz,
  best_score integer,
  best_reproduction_rate integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  -- 권한 검증: 본인 / super_admin / 연결된 강사
  IF v_caller_id = p_student_id THEN
    NULL; -- 본인 허용
  ELSIF public.is_super_admin() THEN
    NULL; -- super_admin 허용
  ELSIF EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = v_caller_id
      AND student_id = p_student_id
      AND deleted_at IS NULL
  ) THEN
    NULL; -- 연결된 강사 허용
  ELSE
    RETURN; -- 그 외 거부
  END IF;

  RETURN QUERY
  SELECT
    q.id AS question_id,
    q.question_text,
    q.question_type,
    q.difficulty,
    q.hint_ko,
    q.audio_url,
    q.sort_order,
    -- 최신 스크립트 (있으면)
    s.id AS script_id,
    s.content AS script_content,
    s.status AS script_status,
    s.created_at AS script_created_at,
    -- 연습 통계
    COALESCE(
      (SELECT COUNT(*) FROM public.practices p
       WHERE p.script_id = s.id AND p.deleted_at IS NULL),
      0
    ) AS practices_count,
    (SELECT MAX(p2.created_at) FROM public.practices p2
     WHERE p2.script_id = s.id AND p2.deleted_at IS NULL) AS last_practice_at,
    (SELECT MAX(p3.score) FROM public.practices p3
     WHERE p3.script_id = s.id AND p3.deleted_at IS NULL AND p3.score IS NOT NULL) AS best_score,
    (SELECT MAX(p4.reproduction_rate) FROM public.practices p4
     WHERE p4.script_id = s.id AND p4.deleted_at IS NULL AND p4.reproduction_rate IS NOT NULL) AS best_reproduction_rate
  FROM public.questions q
  LEFT JOIN LATERAL (
    SELECT sc.*
    FROM public.scripts sc
    WHERE sc.question_id = q.id
      AND sc.student_id = p_student_id
      AND sc.deleted_at IS NULL
      AND sc.status = 'complete'
    ORDER BY sc.created_at DESC
    LIMIT 1
  ) s ON true
  WHERE q.topic_id = p_topic_id
    AND q.is_active = true
  ORDER BY q.sort_order ASC;
END;
$$;

COMMENT ON FUNCTION public.get_topic_questions_with_scripts IS '토픽별 질문 + 스크립트/연습 현황 조회 (role 제거, 관계 기반 인가)';

-- ============================================================================
-- 8. set_student_topics — role 기반 인가 → 관계 기반 인가
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_student_topics(
  p_student_id uuid,
  p_topic_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
  v_topic_id uuid;
BEGIN
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 강사 역할 검증: teacher_student 연결 또는 super_admin
  IF NOT public.is_super_admin() AND NOT EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = v_teacher_id
      AND student_id = p_student_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  -- 기존 배정 hard delete (junction 테이블이므로 감사 불필요)
  DELETE FROM public.student_topics
  WHERE student_id = p_student_id;

  -- 새 토픽 배정
  FOREACH v_topic_id IN ARRAY p_topic_ids
  LOOP
    IF EXISTS (SELECT 1 FROM public.topics WHERE id = v_topic_id AND is_active = true) THEN
      INSERT INTO public.student_topics (student_id, topic_id)
      VALUES (p_student_id, v_topic_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.set_student_topics IS '강사가 학생에게 토픽 배정 (role 제거, 관계 기반 인가)';
