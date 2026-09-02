-- ============================================================================
-- 078: OPIc 핵심 표현 라이브러리
--
-- 변경 내용:
-- 1. NEW TABLE: expression_categories (표현 카테고리)
-- 2. NEW TABLE: expressions (핵심 표현)
-- 3. RLS: 모든 인증 사용자 읽기, teacher/owner만 쓰기
-- 4. RPC: get_expressions (조직별 표현 조회)
--
-- 설계:
-- - 기본 시드 데이터: organization_id IS NULL (글로벌)
-- - 강사 커스텀: organization_id = 소속 조직 (조직별)
-- - 조회 시: 조직 커스텀 > 글로벌 기본값 (카테고리 키 기준 병합)
-- ============================================================================

-- 1. 표현 카테고리
CREATE TABLE IF NOT EXISTS public.expression_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'bookmark-outline',
  color text NOT NULL DEFAULT '#6366F1',
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  -- 같은 조직 내 카테고리 키 중복 방지
  UNIQUE NULLS NOT DISTINCT (organization_id, key)
);

-- 2. 핵심 표현
CREATE TABLE IF NOT EXISTS public.expressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.expression_categories(id) ON DELETE CASCADE,
  expression_en text NOT NULL,
  expression_ko text NOT NULL,
  example text NOT NULL DEFAULT '',
  tip text,
  level text NOT NULL DEFAULT 'basic' CHECK (level IN ('basic', 'intermediate', 'advanced')),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_expression_categories_org ON public.expression_categories(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expressions_category ON public.expressions(category_id) WHERE deleted_at IS NULL;

-- updated_at 자동 갱신
-- 이름을 전용으로 둔다: _update_timestamp 같은 범용 이름을 CREATE OR REPLACE 하면
-- 동일 이름의 기존 트리거 함수를 덮어쓸 위험이 있다.
CREATE OR REPLACE FUNCTION public._expressions_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expression_categories_updated ON public.expression_categories;
CREATE TRIGGER trg_expression_categories_updated
  BEFORE UPDATE ON public.expression_categories
  FOR EACH ROW EXECUTE FUNCTION public._expressions_set_updated_at();

DROP TRIGGER IF EXISTS trg_expressions_updated ON public.expressions;
CREATE TRIGGER trg_expressions_updated
  BEFORE UPDATE ON public.expressions
  FOR EACH ROW EXECUTE FUNCTION public._expressions_set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.expression_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expressions ENABLE ROW LEVEL SECURITY;

-- 카테고리: 인증 사용자 누구나 읽기 (글로벌 + 본인 조직)
CREATE POLICY expression_categories_select ON public.expression_categories
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      organization_id IS NULL  -- 글로벌 기본값
      OR organization_id IN (SELECT public._user_org_ids())  -- 본인 조직
    )
  );

-- 카테고리: teacher/owner만 본인 조직에 추가
CREATE POLICY expression_categories_insert ON public.expression_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.can_teach_in_org(organization_id)
  );

-- 카테고리: teacher/owner만 본인 조직 것 수정
-- WITH CHECK 필수: 없으면 수정 후 organization_id를 다른 조직으로 바꿔치기할 수 있다
CREATE POLICY expression_categories_update ON public.expression_categories
  FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.can_teach_in_org(organization_id)
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.can_teach_in_org(organization_id)
  );

-- 표현: 인증 사용자 누구나 읽기 (카테고리 RLS에 의존)
CREATE POLICY expressions_select ON public.expressions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.expression_categories ec
      WHERE ec.id = category_id
      AND ec.deleted_at IS NULL
      AND (
        ec.organization_id IS NULL
        OR ec.organization_id IN (SELECT public._user_org_ids())
      )
    )
  );

-- 표현: teacher/owner만 본인 조직 카테고리에 추가
CREATE POLICY expressions_insert ON public.expressions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expression_categories ec
      WHERE ec.id = category_id
      AND ec.organization_id IS NOT NULL
      AND public.can_teach_in_org(ec.organization_id)
    )
  );

-- 표현: teacher/owner만 본인 조직 것 수정
-- WITH CHECK 필수: 없으면 category_id를 다른 조직 카테고리로 옮길 수 있다
CREATE POLICY expressions_update ON public.expressions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expression_categories ec
      WHERE ec.id = category_id
      AND ec.organization_id IS NOT NULL
      AND public.can_teach_in_org(ec.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expression_categories ec
      WHERE ec.id = category_id
      AND ec.organization_id IS NOT NULL
      AND public.can_teach_in_org(ec.organization_id)
    )
  );

-- ============================================================================
-- RPC: 조직 표현 조회 (글로벌 + 조직 커스텀 병합)
-- ============================================================================

-- SECURITY INVOKER: 인가는 위 RLS SELECT 정책 한 곳에서만 결정한다.
-- (SECURITY DEFINER면 RLS가 우회되어, 클라이언트가 남의 organization_id를 넣는 것만으로
--  타 조직 커스텀 표현을 읽을 수 있었다. p_organization_id는 권한이 아니라
--  "조직 커스텀이 글로벌을 덮어쓴다"는 우선순위 계산에만 쓰인다.)
CREATE OR REPLACE FUNCTION public.get_expressions(p_organization_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- 소속되지 않은 조직 id를 넘긴 경우 명시적으로 거부한다.
  -- (RLS가 이미 데이터를 차단하지만, 조용히 글로벌 데이터를 돌려주는 대신 원인을 알린다)
  IF p_organization_id IS NOT NULL AND NOT public.is_org_member(p_organization_id) THEN
    RETURN jsonb_build_object('error', 'NOT_ORG_MEMBER');
  END IF;

  -- 카테고리별 표현 조회
  -- 조직 커스텀이 있으면 조직 것만, 없으면 글로벌 기본값 사용
  SELECT COALESCE(jsonb_agg(cat_data ORDER BY cat_sort), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      ec.key AS cat_key,
      ec.sort_order AS cat_sort,
      jsonb_build_object(
        'id', ec.id,
        'key', ec.key,
        'label', ec.label,
        'icon', ec.icon,
        'color', ec.color,
        'description', ec.description,
        'is_custom', ec.organization_id IS NOT NULL,
        'expressions', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'en', e.expression_en,
              'ko', e.expression_ko,
              'example', e.example,
              'tip', e.tip,
              'level', e.level
            ) ORDER BY e.sort_order, e.created_at
          )
          FROM public.expressions e
          WHERE e.category_id = ec.id
            AND e.deleted_at IS NULL
            AND e.is_active = true
          ), '[]'::jsonb
        )
      ) AS cat_data
    FROM public.expression_categories ec
    WHERE ec.deleted_at IS NULL
      AND ec.is_active = true
      AND (
        -- 글로벌 기본값 (조직 커스텀이 없는 카테고리만)
        (ec.organization_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM public.expression_categories ec2
          WHERE ec2.key = ec.key
            AND ec2.organization_id = p_organization_id
            AND ec2.deleted_at IS NULL
        ))
        -- 조직 커스텀
        OR ec.organization_id = p_organization_id
      )
    ORDER BY ec.sort_order
  ) sub;

  RETURN jsonb_build_object('success', true, 'categories', v_result);
END;
$$;

COMMENT ON FUNCTION public.get_expressions IS '핵심 표현 라이브러리 조회 (글로벌 + 조직 커스텀 병합)';
