-- ============================================================================
-- 024_fix_admin_rls_platform_role.sql
--
-- 통합 수정:
--   1) RLS 정책 8개: role='admin' → is_super_admin()
--   2) RPC 함수 9개: role='admin' → is_super_admin()
--   3) image_url CHECK 제약: 쿼리 파라미터 허용
--   4) 시드 데이터: video 섹션 + steps/roadmap/pricing 아이템 + stats 수정
--
-- 근본 원인: 017에서 role='admin' 기반으로 작성 → 020에서 platform_role='super_admin'
--            체계 도입 후 017 코드가 미갱신 상태
-- ============================================================================

-- ============================================================================
-- 1. RLS 정책 (6 테이블 + 2 스토리지)
-- ============================================================================

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
-- 2. image_url CHECK 제약 수정 (쿼리 파라미터 허용)
-- ============================================================================

ALTER TABLE public.landing_items DROP CONSTRAINT IF EXISTS valid_image_url;
ALTER TABLE public.landing_items ADD CONSTRAINT valid_image_url CHECK (
  image_url IS NULL OR image_url ~* '^https?://.+\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$'
);

-- ============================================================================
-- 3. RPC 함수 9개: role='admin' → is_super_admin()
--    변경점: v_caller_role 변수 제거, SELECT role 제거, is_super_admin() 사용
--    v_caller_id는 audit log용으로 유지
-- ============================================================================

-- 3.1 get_admin_dashboard_stats
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
    'total_teachers', (SELECT COUNT(*) FROM public.users WHERE role = 'teacher' AND deleted_at IS NULL),
    'total_students', (SELECT COUNT(*) FROM public.users WHERE role = 'student' AND deleted_at IS NULL),
    'total_practices', (SELECT COUNT(*) FROM public.practices WHERE deleted_at IS NULL),
    'total_scripts', (SELECT COUNT(*) FROM public.scripts WHERE deleted_at IS NULL),
    'active_users_7d', (
      SELECT COUNT(DISTINCT user_id) FROM public.practices
      WHERE created_at > now() - INTERVAL '7 days' AND deleted_at IS NULL
    ),
    'active_users_30d', (
      SELECT COUNT(DISTINCT user_id) FROM public.practices
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

-- 3.2 admin_list_users
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

  SELECT COUNT(*) INTO v_total
  FROM public.users u
  WHERE u.deleted_at IS NULL
    AND (p_role IS NULL OR u.role::text = p_role)
    AND (p_search IS NULL OR u.name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%');

  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_users
  FROM (
    SELECT jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'name', u.name,
      'role', u.role,
      'created_at', u.created_at,
      'push_token', CASE WHEN u.push_token IS NOT NULL THEN true ELSE false END
    ) AS row_data
    FROM public.users u
    WHERE u.deleted_at IS NULL
      AND (p_role IS NULL OR u.role::text = p_role)
      AND (p_search IS NULL OR u.name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%')
    ORDER BY u.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object('success', true, 'users', v_users, 'total', v_total);
END;
$$;

-- 3.3 admin_change_user_role
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
  v_target_role public.user_role;
  v_old_role public.user_role;
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

  SELECT role INTO v_old_role
  FROM public.users WHERE id = p_user_id AND deleted_at IS NULL;

  IF v_old_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF p_user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_CHANGE_OWN_ROLE');
  END IF;

  IF v_old_role = 'admin' THEN
    IF (SELECT COUNT(*) FROM public.users WHERE role = 'admin' AND deleted_at IS NULL) <= 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'LAST_ADMIN_PROTECTION');
    END IF;
  END IF;

  IF p_new_role NOT IN ('admin', 'teacher', 'student') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ROLE');
  END IF;

  v_target_role := p_new_role::public.user_role;

  UPDATE public.users
  SET role = v_target_role, updated_at = now()
  WHERE id = p_user_id AND deleted_at IS NULL;

  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log
  ORDER BY created_at DESC LIMIT 1;

  v_content := 'user_role_change|' || p_user_id::text || '|' || v_old_role::text || '|' || p_new_role || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, resource_id, old_value, new_value, content_hash, previous_hash)
  VALUES (
    v_caller_id,
    'user_role_change',
    'user',
    p_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_new_role),
    encode(extensions.digest(v_content, 'sha256'), 'hex'),
    v_prev_hash
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'old_role', v_old_role, 'new_role', p_new_role);
END;
$$;

-- 3.4 admin_update_landing_section
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

-- 3.5 admin_upsert_landing_item
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

-- 3.6 admin_delete_landing_item
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

-- 3.7 admin_reorder_items
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

-- 3.8 admin_get_subscription_stats
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

-- 3.9 admin_update_plan
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
-- 4. 시드 데이터
-- ============================================================================

-- 4.1 video 섹션 생성 (section_key CHECK에 이미 포함, INSERT만 누락)
INSERT INTO public.landing_sections (section_key, title, subtitle, content, sort_order)
VALUES ('video', '서비스 소개', NULL, '{"video_url": ""}'::jsonb, 10)
ON CONFLICT (section_key) DO NOTHING;

-- 4.2 기존 stats 아이템 수정 (title이 "336+" 형식 → 라벨로 변경, metadata에 value 추가)
UPDATE public.landing_items SET
  title = '자동화 테스트',
  metadata = '{"value": 336, "suffix": "+"}'::jsonb
WHERE section_id = (SELECT id FROM public.landing_sections WHERE section_key = 'stats')
  AND sort_order = 0 AND deleted_at IS NULL;

UPDATE public.landing_items SET
  title = 'AI 에러 분류',
  metadata = '{"value": 53, "suffix": "개"}'::jsonb
WHERE section_id = (SELECT id FROM public.landing_sections WHERE section_key = 'stats')
  AND sort_order = 1 AND deleted_at IS NULL;

UPDATE public.landing_items SET
  title = 'OPIc 질문 유형',
  metadata = '{"value": 6, "suffix": "종"}'::jsonb
WHERE section_id = (SELECT id FROM public.landing_sections WHERE section_key = 'stats')
  AND sort_order = 2 AND deleted_at IS NULL;

UPDATE public.landing_items SET
  title = '모의고사 시간',
  metadata = '{"value": 40, "suffix": "분"}'::jsonb
WHERE section_id = (SELECT id FROM public.landing_sections WHERE section_key = 'stats')
  AND sort_order = 3 AND deleted_at IS NULL;

-- 4.3 steps 아이템 (4개) — 이미 존재하면 건너뜀
INSERT INTO public.landing_items (section_id, title, description, icon, metadata, sort_order)
SELECT s.id, item.title, item.description, item.icon, item.metadata::jsonb, item.sort_order
FROM public.landing_sections s,
(VALUES
  ('강사 등록', '이메일로 간편 가입', 'UserPlus', '{"num": "01"}', 0),
  ('학생 초대', '초대 코드 한 줄로 연결', 'Link', '{"num": "02"}', 1),
  ('스크립트 배정', '토픽별 맞춤 작성', 'PencilLine', '{"num": "03"}', 2),
  ('결과 확인', 'AI 피드백 자동 수신', 'ChartBar', '{"num": "04"}', 3)
) AS item(title, description, icon, metadata, sort_order)
WHERE s.section_key = 'steps'
  AND NOT EXISTS (
    SELECT 1 FROM public.landing_items li
    WHERE li.section_id = s.id AND li.deleted_at IS NULL
  );

-- 4.4 roadmap 아이템 (4개) — 이미 존재하면 건너뜀
INSERT INTO public.landing_items (section_id, title, metadata, sort_order)
SELECT s.id, item.title, item.metadata::jsonb, item.sort_order
FROM public.landing_sections s,
(VALUES
  ('강사-학생 맞춤 학습', '{"phase": "Phase 1", "status": "live", "items": ["강사-학생 연결 시스템", "맞춤 스크립트 작성", "실전 녹음 + AI 피드백", "학습 기록 관리"]}', 0),
  ('혼자서도 학습', '{"phase": "Phase 2", "status": "next", "items": ["AI 스크립트 자동 생성", "학습 통계 대시보드", "독학 모드", "다크모드 지원"]}', 1),
  ('실전 시뮬레이션', '{"phase": "Phase 3", "status": "planned", "items": ["3콤보 롤플레이", "실전 모의고사 40분", "AI 실시간 대화", "성적 분석 리포트"]}', 2),
  ('학원·기업 확장', '{"phase": "Phase 4", "status": "planned", "items": ["멀티 강사 대시보드", "학원 조직 관리", "구독 서비스", "iOS + 다국어"]}', 3)
) AS item(title, metadata, sort_order)
WHERE s.section_key = 'roadmap'
  AND NOT EXISTS (
    SELECT 1 FROM public.landing_items li
    WHERE li.section_id = s.id AND li.deleted_at IS NULL
  );

-- 4.5 pricing 아이템 (3개) — 이미 존재하면 건너뜀
INSERT INTO public.landing_items (section_id, title, description, metadata, sort_order)
SELECT s.id, item.title, item.description, item.metadata::jsonb, item.sort_order
FROM public.landing_sections s,
(VALUES
  ('Free', '개인 강사 시작용', '{"price": "₩0", "period": "영구 무료", "features": ["학생 5명 연결", "스크립트 작성·관리", "녹음 연습 + AI 피드백", "학습 기록 확인"], "cta": "무료로 시작", "highlighted": false}', 0),
  ('Pro', '전문 OPIc 강사용', '{"price": "₩29,900", "period": "/월", "features": ["학생 무제한", "Free 전체 기능", "AI 스크립트 자동 생성", "학습 통계 대시보드", "우선 지원"], "cta": "프로 시작하기", "highlighted": true}', 1),
  ('Academy', '학원·기관 맞춤', '{"price": "문의", "period": "", "features": ["멀티 강사 관리", "학원 대시보드", "맞춤 브랜딩", "API 연동", "전담 매니저"], "cta": "도입 문의", "highlighted": false}', 2)
) AS item(title, description, metadata, sort_order)
WHERE s.section_key = 'pricing'
  AND NOT EXISTS (
    SELECT 1 FROM public.landing_items li
    WHERE li.section_id = s.id AND li.deleted_at IS NULL
  );

-- 4.6 pain_points 아이템 (4개) — 이미 존재하면 건너뜀
INSERT INTO public.landing_items (section_id, title, description, icon, sort_order)
SELECT s.id, item.title, item.description, item.icon, item.sort_order
FROM public.landing_sections s,
(VALUES
  ('반복되는 스크립트 작성', '학생마다 토픽별 맞춤 스크립트를 매번 만들고 수정하는 시간', 'Clock', 0),
  ('실전 연습 환경 부재', '수업 외 시간에 학생이 Ava 음성으로 연습할 도구가 없음', 'Headphones', 1),
  ('피드백의 한계', '녹음된 답변을 일일이 듣고 스크립트와 비교하는 건 현실적으로 불가능', 'FileText', 2),
  ('학습 현황 블랙박스', '누가 얼마나 연습했는지, 어디서 막히는지 데이터 기반 파악이 어려움', 'EyeSlash', 3)
) AS item(title, description, icon, sort_order)
WHERE s.section_key = 'pain_points'
  AND NOT EXISTS (
    SELECT 1 FROM public.landing_items li
    WHERE li.section_id = s.id AND li.deleted_at IS NULL
  );

-- 4.7 features_now 아이템 (4개) — 이미 존재하면 건너뜀
INSERT INTO public.landing_items (section_id, title, description, icon, sort_order)
SELECT s.id, item.title, item.description, item.icon, item.sort_order
FROM public.landing_sections s,
(VALUES
  ('맞춤 스크립트', '학생별 토픽 배정 + 스크립트 작성·관리를 한 곳에서', 'PencilLine', 0),
  ('Ava 음성 시뮬레이션', 'OPIc 가상 진행자의 실제 음성으로 시험 환경 재현', 'Microphone', 1),
  ('AI 자동 피드백', '빠뜨린 표현, 문법 교정, 발음 팁까지 AI가 즉시 분석', 'Lightning', 2),
  ('학습 기록 대시보드', '학생별 연습 이력·점수·재현율을 한눈에 추적', 'TrendUp', 3)
) AS item(title, description, icon, sort_order)
WHERE s.section_key = 'features_now'
  AND NOT EXISTS (
    SELECT 1 FROM public.landing_items li
    WHERE li.section_id = s.id AND li.deleted_at IS NULL
  );

-- 4.8 features_soon 아이템 (4개) — 이미 존재하면 건너뜀
INSERT INTO public.landing_items (section_id, title, description, icon, sort_order)
SELECT s.id, item.title, item.description, item.icon, item.sort_order
FROM public.landing_sections s,
(VALUES
  ('AI 스크립트 생성', '토픽만 고르면 AI가 수준별 스크립트를 자동 생성', 'Cpu', 0),
  ('3콤보 롤플레이', 'OPIc 핵심 3콤보 상황극을 AI와 실시간 시뮬레이션', 'ChatCircle', 1),
  ('실전 모의고사', '40분 12~15문항, 실제 시험과 동일한 환경', 'Trophy', 2),
  ('학원 멀티 관리', '강사 여러 명이 학원 단위로 학생을 함께 관리', 'Users', 3)
) AS item(title, description, icon, sort_order)
WHERE s.section_key = 'features_soon'
  AND NOT EXISTS (
    SELECT 1 FROM public.landing_items li
    WHERE li.section_id = s.id AND li.deleted_at IS NULL
  );
