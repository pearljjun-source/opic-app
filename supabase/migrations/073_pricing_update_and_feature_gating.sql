-- ============================================================================
-- 073: 가격 조정 (B안) + 전환율 완화 조치
-- ============================================================================
-- 변경 내역:
--   1. 가격 인상: Solo 29,900→49,900 / Pro 69,900→99,900 / Academy 199,000→299,000
--   2. 연간 할인 25%로 확대 (기존 21~22%)
--   3. 트라이얼 14일→30일 연장
--   4. Free 티어 AI 피드백 5회 무료 체험 (월간)
--   5. Free 티어 모의고사 월 2회 제한
-- ============================================================================

-- ============================================================================
-- 1. 가격 인상 + 연간 할인 25%
-- ============================================================================

-- Solo: 49,900원/월, 449,000원/년 (25% 할인, 월 37,417원)
UPDATE public.subscription_plans
SET price_monthly = 49900,
    price_yearly = 449000,
    updated_at = now()
WHERE plan_key = 'solo';

-- Pro: 99,900원/월, 899,000원/년 (25% 할인, 월 74,917원)
UPDATE public.subscription_plans
SET price_monthly = 99900,
    price_yearly = 899000,
    updated_at = now()
WHERE plan_key = 'pro';

-- Academy: 299,000원/월, 2,690,000원/년 (25% 할인, 월 224,167원)
UPDATE public.subscription_plans
SET price_monthly = 299000,
    price_yearly = 2690000,
    updated_at = now()
WHERE plan_key = 'academy';

-- ============================================================================
-- 2. Free 티어 AI 피드백 무료 체험 (월 5회) + 모의고사 월간 제한
-- ============================================================================

-- subscription_plans에 새 컬럼 추가
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS free_ai_feedback_monthly int NOT NULL DEFAULT 0;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_exams_monthly int NOT NULL DEFAULT 0;

-- Free 플랜: AI 피드백 월 5회, 모의고사 월 2회
UPDATE public.subscription_plans
SET free_ai_feedback_monthly = 5,
    max_exams_monthly = 2
WHERE plan_key = 'free';

-- 유료 플랜: 0 = 무제한 (기본값이므로 별도 UPDATE 불필요)

-- ============================================================================
-- 3. 트라이얼 14일→30일 연장
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_solo_plan_id uuid;
  v_free_plan_id uuid;
  v_owner_id uuid;
  v_trial_days int := 30;
BEGIN
  SELECT id INTO v_solo_plan_id
  FROM public.subscription_plans
  WHERE plan_key = 'solo' AND is_active = true
  LIMIT 1;

  IF v_solo_plan_id IS NULL THEN
    SELECT id INTO v_free_plan_id
    FROM public.subscription_plans
    WHERE plan_key = 'free' AND is_active = true
    LIMIT 1;

    IF v_free_plan_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.subscriptions (
      user_id, organization_id, plan_id, status,
      billing_provider, billing_cycle,
      current_period_start, current_period_end
    ) VALUES (
      NEW.owner_id, NEW.id, v_free_plan_id, 'active',
      'toss', 'monthly',
      now(), now() + interval '100 years'
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
  END IF;

  v_owner_id := NEW.owner_id;

  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organization_id = NEW.id
    AND status IN ('active', 'trialing', 'past_due')
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.subscriptions (
    user_id, organization_id, plan_id, status,
    billing_provider, billing_cycle,
    trial_ends_at,
    current_period_start, current_period_end
  ) VALUES (
    v_owner_id, NEW.id, v_solo_plan_id, 'trialing',
    'toss', 'monthly',
    now() + (v_trial_days || ' days')::interval,
    now(), now() + (v_trial_days || ' days')::interval
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. check_org_entitlement: ai_feedback Free 체험 + 모의고사 월간 제한
-- ============================================================================

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
  v_grace_days constant int := 7;
  c_free_students constant int := 3;
  c_free_scripts constant int := 5;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

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

  IF v_org_id IS NULL THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, NULL);
  END IF;

  SELECT s.id, s.status, s.plan_id, s.current_period_end
  INTO v_sub
  FROM public.subscriptions s
  WHERE s.organization_id = v_org_id
    AND s.status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, v_org_id);
  END IF;

  IF v_sub.status = 'past_due'
     AND v_sub.current_period_end IS NOT NULL
     AND v_sub.current_period_end + (v_grace_days || ' days')::interval < now()
  THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, v_org_id);
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  IF NOT FOUND THEN
    RETURN public._entitlement_free_default(p_feature_key, v_user_id, v_org_id);
  END IF;

  -- feature별 entitlement 체크
  IF p_feature_key = 'ai_feedback' THEN
    RETURN jsonb_build_object(
      'allowed', v_plan.ai_feedback_enabled,
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id,
      'grace_period', v_sub.status = 'past_due'
    );

  ELSIF p_feature_key = 'tts' THEN
    RETURN jsonb_build_object(
      'allowed', v_plan.tts_enabled,
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id,
      'grace_period', v_sub.status = 'past_due'
    );

  ELSIF p_feature_key = 'translation' THEN
    RETURN jsonb_build_object(
      'allowed', v_plan.translation_enabled,
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id,
      'grace_period', v_sub.status = 'past_due'
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
      'org_id', v_org_id,
      'grace_period', v_sub.status = 'past_due'
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
      'org_id', v_org_id,
      'grace_period', v_sub.status = 'past_due'
    );

  ELSIF p_feature_key = 'max_exams_monthly' THEN
    IF v_plan.max_exams_monthly = 0 THEN
      RETURN jsonb_build_object(
        'allowed', true,
        'limit', 0,
        'plan_key', v_plan.plan_key,
        'org_id', v_org_id
      );
    END IF;

    SELECT COUNT(*) INTO v_used
    FROM public.exam_sessions es
    WHERE es.student_id = v_user_id
      AND es.deleted_at IS NULL
      AND es.status IN ('in_progress', 'completed')
      AND es.created_at > date_trunc('month', now());

    RETURN jsonb_build_object(
      'allowed', v_used < v_plan.max_exams_monthly,
      'limit', v_plan.max_exams_monthly,
      'used', v_used,
      'remaining', GREATEST(0, v_plan.max_exams_monthly - v_used),
      'plan_key', v_plan.plan_key,
      'org_id', v_org_id
    );

  ELSE
    RETURN jsonb_build_object('error', 'UNKNOWN_FEATURE', 'feature_key', p_feature_key);
  END IF;
END;
$$;

-- ============================================================================
-- 5. _entitlement_free_default: ai_feedback 무료 체험 + 모의고사 제한
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
  c_free_ai_monthly constant int := 5;
  c_free_exams_monthly constant int := 2;
BEGIN
  IF p_feature_key = 'ai_feedback' THEN
    -- Free 티어 AI 피드백 월 5회 체험
    IF p_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used
      FROM public.practices pr
      WHERE pr.student_id = p_user_id
        AND pr.ai_feedback IS NOT NULL
        AND pr.created_at > date_trunc('month', now())
        AND pr.deleted_at IS NULL;

      IF v_used < c_free_ai_monthly THEN
        RETURN jsonb_build_object(
          'allowed', true,
          'plan_key', 'free',
          'org_id', p_org_id,
          'reason', 'FREE_TRIAL',
          'limit', c_free_ai_monthly,
          'used', v_used,
          'remaining', c_free_ai_monthly - v_used
        );
      END IF;
    END IF;

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

  ELSIF p_feature_key = 'translation' THEN
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
      v_used := 0;
    END IF;

    RETURN jsonb_build_object(
      'allowed', v_used < c_free_students,
      'limit', c_free_students,
      'used', v_used,
      'remaining', GREATEST(0, c_free_students - v_used),
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
    );

  ELSIF p_feature_key = 'max_scripts' THEN
    IF p_org_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used
      FROM public.scripts
      WHERE organization_id = p_org_id
        AND deleted_at IS NULL;
    ELSE
      v_used := 0;
    END IF;

    RETURN jsonb_build_object(
      'allowed', v_used < c_free_scripts,
      'limit', c_free_scripts,
      'used', v_used,
      'remaining', GREATEST(0, c_free_scripts - v_used),
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
    );

  ELSIF p_feature_key = 'max_exams_monthly' THEN
    IF p_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used
      FROM public.exam_sessions es
      WHERE es.student_id = p_user_id
        AND es.deleted_at IS NULL
        AND es.status IN ('in_progress', 'completed')
        AND es.created_at > date_trunc('month', now());
    ELSE
      v_used := 0;
    END IF;

    RETURN jsonb_build_object(
      'allowed', v_used < c_free_exams_monthly,
      'limit', c_free_exams_monthly,
      'used', v_used,
      'remaining', GREATEST(0, c_free_exams_monthly - v_used),
      'plan_key', 'free',
      'org_id', p_org_id,
      'reason', 'FREE_PLAN'
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

-- ============================================================================
-- 6. check_exam_availability에 월간 제한 체크 추가
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_exam_availability(
  p_exam_type text,
  p_question_count int DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_recent_exams int;
  v_rate_limit jsonb;
  v_monthly_entitlement jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = v_user_id AND om.role = 'student' AND om.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_STUDENT');
  END IF;

  -- 월간 모의고사 제한 체크
  v_monthly_entitlement := public.check_org_entitlement('max_exams_monthly');
  IF v_monthly_entitlement->>'error' IS NULL
     AND NOT (v_monthly_entitlement->>'allowed')::boolean
  THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXAM_MONTHLY_LIMIT',
      'limit', (v_monthly_entitlement->>'limit')::int,
      'used', (v_monthly_entitlement->>'used')::int,
      'remaining', 0
    );
  END IF;

  -- 최근 1시간 내 시험 횟수 (abandoned 제외)
  SELECT COUNT(*) INTO v_recent_exams
  FROM public.exam_sessions es
  WHERE es.student_id = v_user_id
    AND es.deleted_at IS NULL
    AND es.status IN ('in_progress', 'completed')
    AND es.created_at > now() - interval '1 hour';

  IF v_recent_exams >= 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXAM_RATE_LIMIT',
      'exams_remaining', 0
    );
  END IF;

  -- Whisper rate limit 확인
  SELECT jsonb_build_object(
    'allowed', r.allowed,
    'remaining', r.remaining,
    'reset_at', r.reset_at
  ) INTO v_rate_limit
  FROM public.check_api_rate_limit(v_user_id, 'whisper', 30, 60) r;

  IF v_rate_limit IS NOT NULL
     AND (v_rate_limit->>'remaining')::int < p_question_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXAM_INSUFFICIENT_QUOTA',
      'whisper_remaining', (v_rate_limit->>'remaining')::int,
      'needed', p_question_count
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'exams_remaining', 2 - v_recent_exams,
    'whisper_remaining', COALESCE((v_rate_limit->>'remaining')::int, 30),
    'monthly_remaining', CASE
      WHEN v_monthly_entitlement->>'limit' = '0' THEN NULL
      ELSE (v_monthly_entitlement->>'remaining')::int
    END
  );
END;
$$;

-- ============================================================================
-- 7. 랜딩 페이지 pricing 섹션 시드 데이터
--    admin CMS에서 관리 가능하도록 DB에 등록
-- ============================================================================

-- pricing 섹션 생성 (이미 존재하면 무시)
INSERT INTO public.landing_sections (section_key, title, subtitle, sort_order, is_active)
VALUES ('pricing', '합리적인 요금제', '30일 무료 체험으로 시작하고, 연간 결제 시 25% 할인', 7, true)
ON CONFLICT (section_key) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  updated_at = now();

-- 기존 pricing 아이템 삭제 (깨끗한 재생성)
DELETE FROM public.landing_items
WHERE section_id = (SELECT id FROM public.landing_sections WHERE section_key = 'pricing');

-- Free 플랜
INSERT INTO public.landing_items (section_id, title, description, sort_order, metadata)
VALUES (
  (SELECT id FROM public.landing_sections WHERE section_key = 'pricing'),
  'Free',
  '소규모 시작용',
  0,
  jsonb_build_object(
    'price', '₩0',
    'period', '영구 무료',
    'features', jsonb_build_array('학생 3명', '스크립트 5개', '녹음 연습', 'AI 피드백 월 5회 체험', '모의고사 월 2회'),
    'cta', '무료로 시작',
    'highlighted', false
  )
);

-- Solo 플랜
INSERT INTO public.landing_items (section_id, title, description, sort_order, metadata)
VALUES (
  (SELECT id FROM public.landing_sections WHERE section_key = 'pricing'),
  'Solo',
  '개인 OPIc 강사용',
  1,
  jsonb_build_object(
    'price', '₩49,900',
    'period', '/월',
    'features', jsonb_build_array('학생 10명', '스크립트 30개', 'AI 피드백 무제한', 'TTS 음성 + 한→영 번역', '모의고사 무제한'),
    'cta', '30일 무료 체험',
    'highlighted', false
  )
);

-- Pro 플랜
INSERT INTO public.landing_items (section_id, title, description, sort_order, metadata)
VALUES (
  (SELECT id FROM public.landing_sections WHERE section_key = 'pricing'),
  'Pro',
  '전문 강사·소규모 학원용',
  2,
  jsonb_build_object(
    'price', '₩99,900',
    'period', '/월',
    'features', jsonb_build_array('학생 30명', '스크립트 무제한', 'Solo 전체 기능', '반 관리 + 멀티 강사', '우선 지원'),
    'cta', '프로 시작하기',
    'highlighted', true
  )
);

-- Academy 플랜
INSERT INTO public.landing_items (section_id, title, description, sort_order, metadata)
VALUES (
  (SELECT id FROM public.landing_sections WHERE section_key = 'pricing'),
  'Academy',
  '대형 학원·기관 맞춤',
  3,
  jsonb_build_object(
    'price', '₩299,000',
    'period', '/월',
    'features', jsonb_build_array('학생 100명', '스크립트 무제한', 'Pro 전체 기능', '전담 매니저', '연간 결제 25% 할인'),
    'cta', '도입 문의',
    'highlighted', false
  )
);
