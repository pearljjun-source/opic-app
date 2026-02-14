-- ============================================================================
-- 017: Admin Dashboard Infrastructure
-- 관리자 대시보드, Landing CMS, 구독/결제, Audit Log, 데이터 무결성
-- ============================================================================

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 landing_sections (랜딩 페이지 섹션)
-- ----------------------------------------------------------------------------
CREATE TABLE public.landing_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text UNIQUE NOT NULL,
  title text,
  subtitle text,
  content jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  -- 데이터 무결성
  CONSTRAINT valid_section_key CHECK (
    section_key IN ('hero', 'stats', 'pain_points', 'features_now', 'features_soon',
                    'steps', 'roadmap', 'pricing', 'faq', 'cta', 'video')
  ),
  CONSTRAINT valid_title_length CHECK (title IS NULL OR char_length(title) <= 200),
  CONSTRAINT valid_subtitle_length CHECK (subtitle IS NULL OR char_length(subtitle) <= 500),
  CONSTRAINT valid_sort_order_sections CHECK (sort_order >= 0)
);

COMMENT ON TABLE public.landing_sections IS '랜딩 페이지 섹션 (관리자 CMS)';

CREATE INDEX idx_landing_sections_key ON public.landing_sections(section_key) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 1.2 landing_items (섹션 내 개별 아이템)
-- ----------------------------------------------------------------------------
CREATE TABLE public.landing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.landing_sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  icon text,
  image_url text,
  video_url text,
  metadata jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  -- 데이터 무결성
  CONSTRAINT valid_item_title CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT valid_item_desc CHECK (description IS NULL OR char_length(description) <= 2000),
  CONSTRAINT valid_image_url CHECK (
    image_url IS NULL OR image_url ~* '^https?://.+\.(jpg|jpeg|png|webp|gif|svg)$'
  ),
  CONSTRAINT valid_video_url CHECK (
    video_url IS NULL OR video_url ~* '^https?://.+'
  ),
  CONSTRAINT valid_sort_order_items CHECK (sort_order >= 0)
);

COMMENT ON TABLE public.landing_items IS '랜딩 페이지 아이템 (기능 카드, FAQ, 가격표 등)';

CREATE INDEX idx_landing_items_section ON public.landing_items(section_id, sort_order) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 1.3 subscription_plans (구독 플랜 정의)
-- ----------------------------------------------------------------------------
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text UNIQUE NOT NULL,
  name text NOT NULL,
  price_monthly int NOT NULL DEFAULT 0,
  price_yearly int NOT NULL DEFAULT 0,
  max_students int NOT NULL DEFAULT 5,
  max_scripts int NOT NULL DEFAULT 10,
  ai_feedback_enabled boolean NOT NULL DEFAULT false,
  tts_enabled boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 데이터 무결성
  CONSTRAINT valid_plan_key CHECK (plan_key IN ('free', 'solo', 'pro', 'academy')),
  CONSTRAINT valid_price CHECK (price_monthly >= 0 AND price_yearly >= 0),
  CONSTRAINT valid_limits CHECK (max_students > 0 AND max_scripts > 0)
);

COMMENT ON TABLE public.subscription_plans IS '구독 플랜 정의 (Free, Solo, Pro, Academy)';

-- ----------------------------------------------------------------------------
-- 1.4 subscriptions (사용자 구독 상태)
-- ----------------------------------------------------------------------------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active',
  billing_provider text NOT NULL DEFAULT 'toss',
  billing_key text,
  provider_subscription_id text,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 데이터 무결성
  CONSTRAINT valid_sub_status CHECK (
    status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete')
  ),
  CONSTRAINT valid_billing_provider CHECK (billing_provider IN ('toss', 'stripe')),
  CONSTRAINT valid_period CHECK (current_period_end > current_period_start),
  CONSTRAINT one_active_sub_per_user UNIQUE (user_id)
);

COMMENT ON TABLE public.subscriptions IS '사용자 구독 상태 (1인 1구독)';

CREATE INDEX idx_subscriptions_status ON public.subscriptions(status, current_period_end);

-- ----------------------------------------------------------------------------
-- 1.5 payment_history (결제 이력)
-- ----------------------------------------------------------------------------
CREATE TABLE public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount int NOT NULL,
  currency text NOT NULL DEFAULT 'KRW',
  status text NOT NULL DEFAULT 'pending',
  provider_payment_id text,
  payment_method text,
  card_last4 text,
  receipt_url text,
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 데이터 무결성
  CONSTRAINT valid_pay_status CHECK (
    status IN ('pending', 'paid', 'failed', 'refunded', 'canceled')
  ),
  CONSTRAINT valid_amount CHECK (amount >= 0),
  CONSTRAINT valid_currency CHECK (currency IN ('KRW', 'USD'))
);

COMMENT ON TABLE public.payment_history IS '결제 이력 (토스페이먼츠 연동)';

CREATE INDEX idx_payment_history_user ON public.payment_history(user_id, created_at DESC);
CREATE INDEX idx_payment_history_sub ON public.payment_history(subscription_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 1.6 admin_audit_log (관리자 행위 기록 — immutable)
-- ----------------------------------------------------------------------------
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  old_value jsonb,
  new_value jsonb,
  content_hash text NOT NULL,
  previous_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 데이터 무결성
  CONSTRAINT valid_action CHECK (
    action IN ('user_role_change', 'landing_update', 'landing_item_create',
               'landing_item_delete', 'landing_reorder', 'plan_update',
               'subscription_change', 'system_config')
  ),
  CONSTRAINT valid_resource_type CHECK (
    resource_type IN ('user', 'landing_section', 'landing_item',
                      'subscription', 'plan', 'system')
  )
);

COMMENT ON TABLE public.admin_audit_log IS '관리자 행위 기록 (immutable, 변조 감지 해시 체인)';

CREATE INDEX idx_audit_log_admin ON public.admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_audit_log_resource ON public.admin_audit_log(resource_type, resource_id);

-- ============================================================================
-- 2. AUDIT LOG 변조 방지 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log records are immutable';
END;
$$;

CREATE TRIGGER no_audit_update
  BEFORE UPDATE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

CREATE TRIGGER no_audit_delete
  BEFORE DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

-- ============================================================================
-- 3. 기존 테이블 CHECK 제약조건 보강
-- ============================================================================

-- scripts.status 검증 (enum이 아닌 text인 경우)
DO $$ BEGIN
  ALTER TABLE public.scripts ADD CONSTRAINT valid_script_status
    CHECK (status IN ('draft', 'complete'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- practices.audio_url 경로 검증 (path traversal 차단)
DO $$ BEGIN
  ALTER TABLE public.practices ADD CONSTRAINT valid_audio_path
    CHECK (audio_url IS NULL OR (audio_url !~ '\.\.' AND audio_url ~ '^[a-f0-9-]+/'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. 역할 전환 검증 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_role_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- admin → student: 최근 30일 내 admin 행위가 있으면 차단
  IF OLD.role = 'admin' AND NEW.role = 'student' THEN
    IF EXISTS (
      SELECT 1 FROM public.admin_audit_log
      WHERE admin_id = NEW.id
        AND created_at > now() - INTERVAL '30 days'
    ) THEN
      RAISE EXCEPTION 'ADMIN_RECENT_ACTIONS';
    END IF;
  END IF;

  -- teacher → student: 활성 학생이 있으면 차단
  IF OLD.role = 'teacher' AND NEW.role = 'student' THEN
    IF EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = NEW.id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'TEACHER_HAS_STUDENTS';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_role_transition
  BEFORE UPDATE OF role ON public.users
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.validate_role_transition();

-- ============================================================================
-- 5. 구독 다운그레이드 검증 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_plan public.subscription_plans;
  v_new_plan public.subscription_plans;
  v_student_count int;
  v_script_count int;
BEGIN
  -- plan_id가 변경되지 않았으면 pass
  IF OLD.plan_id = NEW.plan_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_old_plan FROM public.subscription_plans WHERE id = OLD.plan_id;
  SELECT * INTO v_new_plan FROM public.subscription_plans WHERE id = NEW.plan_id;

  -- 다운그레이드: 학생 수 한도 확인
  IF v_new_plan.max_students < v_old_plan.max_students THEN
    SELECT COUNT(*) INTO v_student_count
    FROM public.teacher_student
    WHERE teacher_id = NEW.user_id AND deleted_at IS NULL;

    IF v_student_count > v_new_plan.max_students THEN
      RAISE EXCEPTION 'DOWNGRADE_STUDENT_LIMIT';
    END IF;
  END IF;

  -- 다운그레이드: 스크립트 수 한도 확인
  IF v_new_plan.max_scripts < v_old_plan.max_scripts THEN
    SELECT COUNT(*) INTO v_script_count
    FROM public.scripts
    WHERE teacher_id = NEW.user_id AND deleted_at IS NULL;

    IF v_script_count > v_new_plan.max_scripts THEN
      RAISE EXCEPTION 'DOWNGRADE_SCRIPT_LIMIT';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_subscription_downgrade
  BEFORE UPDATE OF plan_id ON public.subscriptions
  FOR EACH ROW
  WHEN (OLD.plan_id IS DISTINCT FROM NEW.plan_id)
  EXECUTE FUNCTION public.validate_subscription_change();

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

ALTER TABLE public.landing_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- landing_sections: public read (active only), admin all
CREATE POLICY "landing_sections_public_read" ON public.landing_sections
  FOR SELECT USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "landing_sections_admin_all" ON public.landing_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL)
  );

-- landing_items: public read (active only), admin all
CREATE POLICY "landing_items_public_read" ON public.landing_items
  FOR SELECT USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "landing_items_admin_all" ON public.landing_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL)
  );

-- subscription_plans: public read (active only), admin all
CREATE POLICY "plans_public_read" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "plans_admin_all" ON public.subscription_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL)
  );

-- subscriptions: own read, admin all
CREATE POLICY "subscriptions_own_read" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "subscriptions_admin_all" ON public.subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL)
  );

-- payment_history: own read, admin read
CREATE POLICY "payments_own_read" ON public.payment_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "payments_admin_read" ON public.payment_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL)
  );

-- admin_audit_log: admin read only (INSERT는 SECURITY DEFINER 내부)
CREATE POLICY "audit_admin_read" ON public.admin_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL)
  );

-- ============================================================================
-- 7. STORAGE — landing-assets 버킷
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'landing-assets',
  'landing-assets',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- admin만 업로드 가능
CREATE POLICY "landing_assets_admin_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'landing-assets'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL)
  );

-- 모든 사용자 조회 가능 (public bucket)
CREATE POLICY "landing_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'landing-assets');

-- admin만 삭제 가능
CREATE POLICY "landing_assets_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'landing-assets'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL)
  );

-- ============================================================================
-- 8. RPC FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 8.1 get_admin_dashboard_stats — KPI 통계
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
  v_result jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.users WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
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

COMMENT ON FUNCTION public.get_admin_dashboard_stats IS 'Admin: 대시보드 KPI 통계';

-- ----------------------------------------------------------------------------
-- 8.2 admin_list_users — 사용자 목록 (페이지네이션)
-- ----------------------------------------------------------------------------
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
  v_caller_role public.user_role;
  v_users jsonb;
  v_total int;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.users WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 총 수 (필터 적용)
  SELECT COUNT(*) INTO v_total
  FROM public.users u
  WHERE u.deleted_at IS NULL
    AND (p_role IS NULL OR u.role::text = p_role)
    AND (p_search IS NULL OR u.name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%');

  -- 사용자 목록
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

COMMENT ON FUNCTION public.admin_list_users IS 'Admin: 사용자 목록 (검색, 필터, 페이지네이션)';

-- ----------------------------------------------------------------------------
-- 8.3 admin_change_user_role — 역할 변경 + audit log
-- ----------------------------------------------------------------------------
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
  v_caller_role public.user_role;
  v_target_role public.user_role;
  v_old_role public.user_role;
  v_prev_hash text;
  v_content text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.users WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 대상 사용자 조회
  SELECT role INTO v_old_role
  FROM public.users WHERE id = p_user_id AND deleted_at IS NULL;

  IF v_old_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- 본인 역할 변경 불가
  IF p_user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_CHANGE_OWN_ROLE');
  END IF;

  -- admin 보호: 마지막 admin 강등 불가
  IF v_old_role = 'admin' THEN
    IF (SELECT COUNT(*) FROM public.users WHERE role = 'admin' AND deleted_at IS NULL) <= 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'LAST_ADMIN_PROTECTION');
    END IF;
  END IF;

  -- 역할 유효성 검증
  IF p_new_role NOT IN ('admin', 'teacher', 'student') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ROLE');
  END IF;

  v_target_role := p_new_role::public.user_role;

  -- 역할 변경 (SECURITY DEFINER → protect_user_columns 트리거 bypass)
  UPDATE public.users
  SET role = v_target_role, updated_at = now()
  WHERE id = p_user_id AND deleted_at IS NULL;

  -- audit log (content_hash 체인)
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

COMMENT ON FUNCTION public.admin_change_user_role IS 'Admin: 사용자 역할 변경 + audit log';

-- ----------------------------------------------------------------------------
-- 8.4 admin_update_landing_section — 섹션 수정
-- ----------------------------------------------------------------------------
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
  v_caller_role public.user_role;
  v_section_id uuid;
  v_old_values jsonb;
  v_prev_hash text;
  v_content text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.users WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 섹션 조회
  SELECT id, jsonb_build_object('title', title, 'subtitle', subtitle, 'content', content, 'is_active', is_active)
  INTO v_section_id, v_old_values
  FROM public.landing_sections
  WHERE section_key = p_section_key AND deleted_at IS NULL;

  IF v_section_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SECTION_NOT_FOUND');
  END IF;

  -- 업데이트
  UPDATE public.landing_sections SET
    title = COALESCE(p_updates->>'title', title),
    subtitle = COALESCE(p_updates->>'subtitle', subtitle),
    content = COALESCE(p_updates->'content', content),
    is_active = COALESCE((p_updates->>'is_active')::boolean, is_active),
    updated_at = now()
  WHERE id = v_section_id;

  -- audit log
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 1;

  v_content := 'landing_update|' || v_section_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, resource_id, old_value, new_value, content_hash, previous_hash)
  VALUES (v_caller_id, 'landing_update', 'landing_section', v_section_id, v_old_values, p_updates, encode(extensions.digest(v_content, 'sha256'), 'hex'), v_prev_hash);

  RETURN jsonb_build_object('success', true, 'section_id', v_section_id);
END;
$$;

COMMENT ON FUNCTION public.admin_update_landing_section IS 'Admin: 랜딩 섹션 수정 + audit log';

-- ----------------------------------------------------------------------------
-- 8.5 admin_upsert_landing_item — 아이템 생성/수정
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_upsert_landing_item(p_item jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
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

  SELECT role INTO v_caller_role
  FROM public.users WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  v_item_id := (p_item->>'id')::uuid;
  v_section_id := (p_item->>'section_id')::uuid;

  -- section 존재 확인
  IF NOT EXISTS (SELECT 1 FROM public.landing_sections WHERE id = v_section_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SECTION_NOT_FOUND');
  END IF;

  IF v_item_id IS NOT NULL THEN
    -- 수정
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
    -- 생성
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

  -- audit log
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

COMMENT ON FUNCTION public.admin_upsert_landing_item IS 'Admin: 랜딩 아이템 생성/수정 + audit log';

-- ----------------------------------------------------------------------------
-- 8.6 admin_delete_landing_item — 아이템 soft delete
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_landing_item(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
  v_prev_hash text;
  v_content text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.users WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  UPDATE public.landing_items
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ITEM_NOT_FOUND');
  END IF;

  -- audit log
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 1;

  v_content := 'landing_item_delete|' || p_item_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, resource_id, content_hash, previous_hash)
  VALUES (v_caller_id, 'landing_item_delete', 'landing_item', p_item_id, encode(extensions.digest(v_content, 'sha256'), 'hex'), v_prev_hash);

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_delete_landing_item IS 'Admin: 랜딩 아이템 soft delete + audit log';

-- ----------------------------------------------------------------------------
-- 8.7 admin_reorder_items — sort_order 일괄 변경
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reorder_items(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
  v_item jsonb;
  v_prev_hash text;
  v_content text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.users WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.landing_items
    SET sort_order = (v_item->>'sort_order')::int, updated_at = now()
    WHERE id = (v_item->>'id')::uuid AND deleted_at IS NULL;
  END LOOP;

  -- audit log
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 1;

  v_content := 'landing_reorder|' || p_items::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, new_value, content_hash, previous_hash)
  VALUES (v_caller_id, 'landing_reorder', 'landing_item', p_items, encode(extensions.digest(v_content, 'sha256'), 'hex'), v_prev_hash);

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_reorder_items IS 'Admin: 랜딩 아이템 순서 변경 + audit log';

-- ----------------------------------------------------------------------------
-- 8.8 admin_get_subscription_stats — 구독 통계
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_subscription_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
  v_result jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.users WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
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

COMMENT ON FUNCTION public.admin_get_subscription_stats IS 'Admin: 구독 통계 (MRR, churn, 플랜 분포)';

-- ----------------------------------------------------------------------------
-- 8.9 admin_update_plan — 플랜 수정
-- ----------------------------------------------------------------------------
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
  v_caller_role public.user_role;
  v_old_values jsonb;
  v_prev_hash text;
  v_content text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.users WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  -- 기존 값 저장
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

  -- audit log
  SELECT content_hash INTO v_prev_hash
  FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 1;

  v_content := 'plan_update|' || p_plan_id::text || '|' || COALESCE(v_prev_hash, 'genesis');

  INSERT INTO public.admin_audit_log (admin_id, action, resource_type, resource_id, old_value, new_value, content_hash, previous_hash)
  VALUES (v_caller_id, 'plan_update', 'plan', p_plan_id, v_old_values, p_updates, encode(extensions.digest(v_content, 'sha256'), 'hex'), v_prev_hash);

  RETURN jsonb_build_object('success', true, 'plan_id', p_plan_id);
END;
$$;

COMMENT ON FUNCTION public.admin_update_plan IS 'Admin: 구독 플랜 수정 + audit log';

-- ============================================================================
-- 9. SEED DATA
-- ============================================================================

-- 구독 플랜
INSERT INTO public.subscription_plans (plan_key, name, price_monthly, price_yearly, max_students, max_scripts, ai_feedback_enabled, tts_enabled, features, sort_order)
VALUES
  ('free', 'Free', 0, 0, 3, 5, false, false, '["학생 3명 연결", "스크립트 5개", "녹음 연습"]'::jsonb, 0),
  ('solo', 'Solo', 19900, 189000, 10, 30, true, true, '["학생 10명 연결", "스크립트 30개", "AI 피드백", "TTS 음성"]'::jsonb, 1),
  ('pro', 'Pro', 39900, 379000, 30, 999999, true, true, '["학생 30명 연결", "스크립트 무제한", "AI 피드백", "TTS 음성", "우선 지원"]'::jsonb, 2),
  ('academy', 'Academy', 79900, 759000, 100, 999999, true, true, '["학생 100명 연결", "스크립트 무제한", "AI 피드백", "TTS 우선처리", "멀티 강사", "전담 매니저"]'::jsonb, 3)
ON CONFLICT (plan_key) DO NOTHING;

-- 랜딩 페이지 섹션
INSERT INTO public.landing_sections (section_key, title, subtitle, sort_order)
VALUES
  ('hero', 'OPIc 수업, AI가 함께 합니다', '강사와 학생을 위한 OPIc 맞춤 학습 플랫폼', 0),
  ('stats', NULL, NULL, 1),
  ('pain_points', '강사님, 이런 고민 있으시죠?', NULL, 2),
  ('features_now', '지금 바로 사용할 수 있는 기능', NULL, 3),
  ('features_soon', 'Coming Soon', NULL, 4),
  ('steps', '4단계로 시작하세요', NULL, 5),
  ('roadmap', '로드맵', NULL, 6),
  ('pricing', '합리적인 요금제', NULL, 7),
  ('faq', '자주 묻는 질문', NULL, 8),
  ('cta', 'OPIc 수업의 새로운 기준, Speaky와 시작하세요', NULL, 9)
ON CONFLICT (section_key) DO NOTHING;

-- 랜딩 아이템: stats
INSERT INTO public.landing_items (section_id, title, description, metadata, sort_order)
SELECT s.id, item.title, NULL, item.metadata::jsonb, item.sort_order
FROM public.landing_sections s,
(VALUES
  ('336+', '{"suffix": "+"}', 'stats', 0),
  ('53개', '{"suffix": "개"}', 'stats', 1),
  ('6종', '{"suffix": "종"}', 'stats', 2),
  ('40분', '{"suffix": "분"}', 'stats', 3)
) AS item(title, metadata, section_key, sort_order)
WHERE s.section_key = 'stats'
ON CONFLICT DO NOTHING;

-- 랜딩 아이템: pain_points
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
ON CONFLICT DO NOTHING;

-- 랜딩 아이템: features_now
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
ON CONFLICT DO NOTHING;

-- 랜딩 아이템: features_soon
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
ON CONFLICT DO NOTHING;

-- 랜딩 아이템: faq
INSERT INTO public.landing_items (section_id, title, description, sort_order)
SELECT s.id, item.q, item.a, item.sort_order
FROM public.landing_sections s,
(VALUES
  ('Speaky는 어떤 서비스인가요?', 'OPIc 강사와 학원을 위한 AI 학습 관리 플랫폼입니다. 강사가 학생별 맞춤 스크립트를 작성하고, 학생은 Ava 음성으로 실전 연습을 하며, AI가 자동 피드백을 제공합니다.', 0),
  ('학생은 어떻게 가입하나요?', '강사가 발급한 초대 코드를 입력하면 자동으로 연결됩니다. 학생은 별도 결제 없이 배정된 스크립트로 바로 연습을 시작할 수 있어요.', 1),
  ('AI 피드백은 어떤 방식인가요?', '녹음된 답변을 음성 인식(Whisper)으로 텍스트 변환 후, AI(Claude)가 원본 스크립트와 비교하여 빠뜨린 표현, 문법 교정, 발음 팁, 개선 제안 등을 자동 생성합니다.', 2),
  ('무료 플랜으로 충분한가요?', '학생 3명 이하라면 핵심 기능을 모두 무료로 사용할 수 있습니다. 학생 수가 늘거나 AI 피드백이 필요하면 Solo로 전환하세요.', 3),
  ('학원 단위로 도입할 수 있나요?', 'Academy 플랜으로 여러 강사와 학생을 조직 단위로 관리할 수 있습니다. 도입 문의를 남겨주시면 맞춤 안내를 드립니다.', 4)
) AS item(q, a, sort_order)
WHERE s.section_key = 'faq'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. pgcrypto 확장 (SHA256 해시용)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
