-- ============================================================================
-- 020: Organization 기반 멀티테넌트 구조 전환
-- ============================================================================
-- 목적: 단일 역할 시스템(users.role)에서 조직 기반 역할 시스템으로 전환
--
-- Platform Level:
--   super_admin (Jin) — 전체 SaaS 관리
--
-- Organization Level (학원별):
--   owner   — 학원 원장. 구독결제 + 강사관리 + 직접 수업 가능 (teacher 상위호환)
--   teacher — 강사. 학생관리 + 스크립트 작성
--   student — 학생. 연습/녹음
--
-- 핵심 원칙:
--   - owner = teacher 상위호환 (모든 강사 기능 포함)
--   - 조직별 데이터 격리
--   - 구독은 조직 단위
--   - multi-org 지원 (한 사용자가 여러 학원 소속 가능)
-- ============================================================================

-- ============================================================================
-- 1. NEW TYPES
-- ============================================================================

CREATE TYPE public.org_role AS ENUM ('owner', 'teacher', 'student');
CREATE TYPE public.platform_role AS ENUM ('super_admin');

-- ============================================================================
-- 2. NEW TABLES
-- ============================================================================

-- 2-A. organizations — 학원/조직
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  owner_id uuid NOT NULL REFERENCES public.users(id),
  logo_url text,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT valid_org_name CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT valid_slug CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]{3,50}$')
);

CREATE INDEX idx_organizations_owner ON public.organizations(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_slug ON public.organizations(slug) WHERE deleted_at IS NULL AND slug IS NOT NULL;

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

COMMENT ON TABLE public.organizations IS '학원/조직';

-- 2-B. organization_members — 조직 멤버십 + 역할
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  role public.org_role NOT NULL,
  invited_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Soft-delete 호환 UNIQUE (동일 조직에 중복 가입 불가)
CREATE UNIQUE INDEX uq_org_member_active
  ON public.organization_members(organization_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_org_members_user ON public.organization_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_org_members_org_role ON public.organization_members(organization_id, role) WHERE deleted_at IS NULL;

CREATE TRIGGER set_org_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

COMMENT ON TABLE public.organization_members IS '조직 멤버십 (역할: owner/teacher/student)';

-- ============================================================================
-- 3. ALTER EXISTING TABLES
-- ============================================================================

-- 3-A. users — platform_role 추가
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS platform_role public.platform_role DEFAULT NULL;

-- 3-B. teacher_student — organization_id 추가
ALTER TABLE public.teacher_student
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 3-C. invites — organization_id + target_role 추가
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS target_role public.org_role NOT NULL DEFAULT 'student';

-- 3-D. classes — organization_id 추가
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 3-E. scripts — organization_id 추가 (RLS 성능 비정규화)
ALTER TABLE public.scripts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 3-F. practices — organization_id 추가 (RLS 성능 비정규화)
ALTER TABLE public.practices
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 3-G. subscriptions — organization_id 추가
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- ============================================================================
-- 4. DATA MIGRATION
-- ============================================================================

-- 4-1. 기존 admin 사용자 → super_admin 승격
UPDATE public.users
SET platform_role = 'super_admin'
WHERE role = 'admin' AND deleted_at IS NULL;

-- 4-2. 기존 teacher마다 organization 자동 생성
INSERT INTO public.organizations (id, name, owner_id)
SELECT gen_random_uuid(), u.name || '의 학원', u.id
FROM public.users u
WHERE u.role = 'teacher' AND u.deleted_at IS NULL;

-- 4-3. teacher → organization_members (owner)
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT o.id, o.owner_id, 'owner'::public.org_role
FROM public.organizations o
WHERE o.deleted_at IS NULL;

-- 4-4. teacher_student → org_id 채우기
WITH teacher_orgs AS (
  SELECT om.user_id AS teacher_id, om.organization_id
  FROM public.organization_members om
  WHERE om.role = 'owner' AND om.deleted_at IS NULL
)
UPDATE public.teacher_student ts
SET organization_id = t_org.organization_id
FROM teacher_orgs t_org
WHERE ts.teacher_id = t_org.teacher_id AND ts.deleted_at IS NULL
  AND ts.organization_id IS NULL;

-- 4-5. student → organization_members (student)
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT DISTINCT ts.organization_id, ts.student_id, 'student'::public.org_role
FROM public.teacher_student ts
WHERE ts.organization_id IS NOT NULL AND ts.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- 4-6. scripts → org_id 채우기
UPDATE public.scripts s
SET organization_id = ts.organization_id
FROM public.teacher_student ts
WHERE s.teacher_id = ts.teacher_id AND s.student_id = ts.student_id
  AND ts.deleted_at IS NULL AND s.deleted_at IS NULL
  AND s.organization_id IS NULL;

-- 4-7. practices → org_id 채우기
UPDATE public.practices p
SET organization_id = s.organization_id
FROM public.scripts s
WHERE p.script_id = s.id AND s.deleted_at IS NULL AND p.deleted_at IS NULL
  AND p.organization_id IS NULL;

-- 4-8. classes → org_id 채우기
UPDATE public.classes c
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE c.teacher_id = om.user_id AND om.role = 'owner' AND om.deleted_at IS NULL
  AND c.organization_id IS NULL;

-- 4-9. invites → org_id 채우기
UPDATE public.invites i
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE i.teacher_id = om.user_id AND om.role IN ('owner', 'teacher') AND om.deleted_at IS NULL
  AND i.organization_id IS NULL;

-- 4-10. subscriptions → org_id 채우기
UPDATE public.subscriptions sub
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE sub.user_id = om.user_id AND om.role = 'owner' AND om.deleted_at IS NULL
  AND sub.organization_id IS NULL;

-- ============================================================================
-- 5. NOT NULL CONSTRAINTS (데이터 마이그레이션 후)
-- ============================================================================

ALTER TABLE public.teacher_student ALTER COLUMN organization_id SET NOT NULL;
-- invites: 기존 데이터가 없을 수 있으므로 NULL 허용 유지 (새 초대만 NOT NULL 보장은 RPC에서)
-- classes, scripts, practices: 기존 데이터가 없을 수 있으므로 NULL 허용 유지

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_teacher_student_org ON public.teacher_student(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scripts_org ON public.scripts(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_practices_org ON public.practices(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_org ON public.classes(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invites_org ON public.invites(organization_id) WHERE deleted_at IS NULL;

-- subscriptions: org 기반 구독 고유 제약
-- 기존 one_active_sub_per_user는 유지 (호환), org 기반 추가
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_subscription_active
  ON public.subscriptions(organization_id)
  WHERE status = 'active' AND organization_id IS NOT NULL;

-- ============================================================================
-- 6. INTEGRITY TRIGGERS
-- ============================================================================

-- 6-A. owner 최소 1명 보호
CREATE OR REPLACE FUNCTION public.protect_last_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- owner가 다른 역할로 변경되거나 soft-delete 되는 경우
  IF OLD.role = 'owner' AND (NEW.role != 'owner' OR NEW.deleted_at IS NOT NULL) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = OLD.organization_id
        AND role = 'owner'
        AND id != OLD.id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'LAST_OWNER';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_last_owner
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();

-- 6-B. 조직 내 관계 검증 (teacher_student 삽입 시)
CREATE OR REPLACE FUNCTION public.validate_org_relationship()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- teacher가 해당 조직의 owner 또는 teacher인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = NEW.organization_id
      AND user_id = NEW.teacher_id
      AND role IN ('owner', 'teacher')
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'TEACHER_NOT_IN_ORG';
  END IF;
  -- student가 해당 조직의 student인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = NEW.organization_id
      AND user_id = NEW.student_id
      AND role = 'student'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'STUDENT_NOT_IN_ORG';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_org_relationship
  BEFORE INSERT ON public.teacher_student
  FOR EACH ROW EXECUTE FUNCTION public.validate_org_relationship();

-- 6-C. handle_new_user 업데이트 (platform_role 컬럼 추가)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, platform_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    'student',
    NULL
  );
  RETURN NEW;
END;
$$;

-- 6-D. protect_user_columns 업데이트 (platform_role 보호 추가)
CREATE OR REPLACE FUNCTION public.protect_user_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY DEFINER 함수 (current_user = postgres) 는 bypass
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 보호 컬럼: role, email, id, created_at, platform_role
  NEW.role := OLD.role;
  NEW.email := OLD.email;
  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;
  NEW.platform_role := OLD.platform_role;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 7. RLS HELPER FUNCTIONS
-- ============================================================================

-- 7-A. is_org_member: 사용자의 조직 멤버십 확인
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid, p_roles public.org_role[] DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_roles IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = p_org_id AND user_id = auth.uid() AND deleted_at IS NULL
    );
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
      AND role = ANY(p_roles) AND deleted_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.is_org_member IS '사용자가 해당 조직의 멤버인지 확인 (역할 필터 선택적)';

-- 7-B. can_teach_in_org: owner 또는 teacher인지
CREATE OR REPLACE FUNCTION public.can_teach_in_org(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.is_org_member(p_org_id, ARRAY['owner', 'teacher']::public.org_role[]);
END;
$$;

COMMENT ON FUNCTION public.can_teach_in_org IS '사용자가 해당 조직에서 수업 권한이 있는지 (owner/teacher)';

-- 7-C. is_super_admin: 플랫폼 관리자 여부
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND platform_role = 'super_admin' AND deleted_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.is_super_admin IS '현재 사용자가 super_admin인지 확인';

-- 7-D. get_user_org_role: 특정 조직에서의 역할 조회
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_org_id uuid)
RETURNS public.org_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = auth.uid() AND deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.get_user_org_role IS '현재 사용자의 특정 조직 내 역할 조회';

-- ============================================================================
-- 8. RLS POLICIES FOR NEW TABLES
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- organizations: 멤버 또는 super_admin만 조회
CREATE POLICY "organizations_select"
  ON public.organizations FOR SELECT USING (
    deleted_at IS NULL AND (
      public.is_org_member(id)
      OR public.is_super_admin()
    )
  );

-- organizations: owner만 수정
CREATE POLICY "organizations_update"
  ON public.organizations FOR UPDATE USING (
    deleted_at IS NULL
    AND public.is_org_member(id, ARRAY['owner']::public.org_role[])
  );

-- organizations: INSERT는 create_organization RPC를 통해서만 (SECURITY DEFINER)
-- 직접 INSERT 차단
CREATE POLICY "organizations_insert"
  ON public.organizations FOR INSERT WITH CHECK (false);

-- organization_members: 같은 조직 멤버 또는 super_admin
CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT USING (
    deleted_at IS NULL AND (
      public.is_org_member(organization_id)
      OR public.is_super_admin()
    )
  );

-- organization_members: owner만 수정 (멤버 역할 변경/제거)
CREATE POLICY "org_members_update"
  ON public.organization_members FOR UPDATE USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id, ARRAY['owner']::public.org_role[])
  );

-- organization_members: INSERT는 RPC를 통해서만
CREATE POLICY "org_members_insert"
  ON public.organization_members FOR INSERT WITH CHECK (false);

-- ============================================================================
-- 9. NEW RPCs — 조직 관리
-- ============================================================================

-- 9-A. create_organization: 학원 생성
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

  -- 이름 검증
  IF p_name IS NULL OR char_length(trim(p_name)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_NAME_REQUIRED');
  END IF;

  -- slug 검증 (선택적)
  IF p_slug IS NOT NULL AND p_slug !~ '^[a-z0-9-]{3,50}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_INVALID_SLUG');
  END IF;

  -- slug 중복 확인
  IF p_slug IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = p_slug AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORG_SLUG_TAKEN');
  END IF;

  -- 조직 생성
  INSERT INTO public.organizations (name, slug, owner_id)
  VALUES (trim(p_name), p_slug, v_user_id)
  RETURNING id INTO v_org_id;

  -- owner 멤버십 추가
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  -- users.role이 student인 경우 teacher로 변경 (하위 호환)
  UPDATE public.users
  SET role = 'teacher'
  WHERE id = v_user_id AND role = 'student' AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id
  );
END;
$$;

COMMENT ON FUNCTION public.create_organization IS '학원/조직 생성 + owner 자동 등록';

-- 9-B. get_my_organizations: 내가 속한 조직 목록
CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS TABLE(id uuid, name text, role public.org_role, member_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    om.role,
    (SELECT COUNT(*) FROM public.organization_members om2
     WHERE om2.organization_id = o.id AND om2.deleted_at IS NULL) AS member_count
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
  WHERE om.user_id = v_user_id AND om.deleted_at IS NULL
  ORDER BY om.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_my_organizations IS '현재 사용자가 속한 조직 목록 조회';

-- 9-C. get_org_teachers: 조직 내 강사/원장 목록 (owner만)
CREATE OR REPLACE FUNCTION public.get_org_teachers(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  role public.org_role,
  created_at timestamptz,
  students_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- owner만 강사 목록 조회 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = v_user_id
      AND role = 'owner' AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    om.role,
    om.created_at,
    (SELECT COUNT(*) FROM public.teacher_student ts
     WHERE ts.teacher_id = u.id
       AND ts.organization_id = p_org_id
       AND ts.deleted_at IS NULL) AS students_count
  FROM public.organization_members om
  JOIN public.users u ON u.id = om.user_id AND u.deleted_at IS NULL
  WHERE om.organization_id = p_org_id
    AND om.role IN ('owner', 'teacher')
    AND om.deleted_at IS NULL
  ORDER BY om.role ASC, u.name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_org_teachers IS 'Owner: 조직 내 강사/원장 목록 (학생 수 포함)';

-- 9-D. remove_org_member: 조직에서 멤버 제거 (owner만)
CREATE OR REPLACE FUNCTION public.remove_org_member(p_org_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_target_role public.org_role;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- caller가 owner인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = v_caller_id
      AND role = 'owner' AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'OWNER_ONLY');
  END IF;

  -- 대상 멤버 역할 확인
  SELECT role INTO v_target_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  -- 자기 자신은 제거 불가 (마지막 owner 보호)
  IF p_user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_REMOVE_SELF');
  END IF;

  -- soft delete
  UPDATE public.organization_members
  SET deleted_at = now()
  WHERE organization_id = p_org_id AND user_id = p_user_id AND deleted_at IS NULL;

  -- teacher/owner인 경우: 해당 조직의 teacher_student 연결도 해제
  IF v_target_role IN ('owner', 'teacher') THEN
    UPDATE public.teacher_student
    SET deleted_at = now()
    WHERE teacher_id = p_user_id AND organization_id = p_org_id AND deleted_at IS NULL;
  END IF;

  -- student인 경우: 해당 조직의 teacher_student 연결 + 관련 데이터 해제
  IF v_target_role = 'student' THEN
    UPDATE public.teacher_student
    SET deleted_at = now()
    WHERE student_id = p_user_id AND organization_id = p_org_id AND deleted_at IS NULL;

    -- class_members: 해당 조직 강사의 반에서 제거
    UPDATE public.class_members SET deleted_at = now()
    WHERE student_id = p_user_id
      AND class_id IN (
        SELECT c.id FROM public.classes c
        JOIN public.organization_members om ON om.user_id = c.teacher_id
          AND om.organization_id = p_org_id AND om.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
      )
      AND deleted_at IS NULL;

    -- student_topics: 해당 학생의 토픽 배정 해제
    UPDATE public.student_topics SET deleted_at = now()
    WHERE student_id = p_user_id AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.remove_org_member IS 'Owner: 조직에서 멤버 제거 (soft delete + 연결 해제)';

-- 9-E. change_member_role: 멤버 역할 변경 (owner만)
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

  -- caller가 owner인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = v_caller_id
      AND role = 'owner' AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'OWNER_ONLY');
  END IF;

  -- 대상 멤버 현재 역할 확인
  SELECT role INTO v_current_role
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF v_current_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  -- 자기 자신의 owner 역할 변경 불가 (마지막 owner 보호는 트리거에서)
  IF p_user_id = v_caller_id AND p_new_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_DEMOTE_SELF');
  END IF;

  -- student ↔ teacher/owner 전환 시 데이터 정합성 문제 방지
  IF v_current_role = 'student' AND p_new_role IN ('owner', 'teacher') THEN
    -- student → teacher/owner: users.role 업데이트 (하위 호환)
    UPDATE public.users SET role = 'teacher'
    WHERE id = p_user_id AND role = 'student' AND deleted_at IS NULL;
  END IF;

  -- 역할 변경 (protect_last_owner 트리거가 마지막 owner 보호)
  UPDATE public.organization_members
  SET role = p_new_role, updated_at = now()
  WHERE organization_id = p_org_id AND user_id = p_user_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true, 'new_role', p_new_role);
END;
$$;

COMMENT ON FUNCTION public.change_member_role IS 'Owner: 멤버 역할 변경 (owner→teacher/teacher→owner 등)';

-- ============================================================================
-- 10. UPDATED RPCs — 초대 플로우
-- ============================================================================

-- 10-A. create_invite: 조직 + 대상 역할 지정
-- 기존 1-파라미터 함수 제거 (새 함수가 DEFAULT로 호환)
DROP FUNCTION IF EXISTS public.create_invite(int);
CREATE OR REPLACE FUNCTION public.create_invite(
  p_expires_in_days int DEFAULT 7,
  p_target_role public.org_role DEFAULT 'student'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_org_id uuid;
  v_org_role public.org_role;
  v_code text;
  v_invite_id uuid;
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
    -- 하위 호환: org 멤버가 아닌 teacher도 초대 가능
    SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id AND deleted_at IS NULL;
    IF v_user_role != 'teacher' AND v_user_role != 'admin' THEN
      RETURN jsonb_build_object('success', false, 'error', 'NOT_TEACHER');
    END IF;

    -- 자동으로 조직 생성
    INSERT INTO public.organizations (name, owner_id)
    VALUES ((SELECT name FROM public.users WHERE id = v_user_id) || '의 학원', v_user_id)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner');

    v_org_role := 'owner';
  END IF;

  -- teacher는 student만 초대 가능, owner는 teacher도 초대 가능
  IF p_target_role = 'teacher' AND v_org_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'OWNER_ONLY');
  END IF;

  -- owner 초대는 불가 (보안)
  IF p_target_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_INVITE_OWNER');
  END IF;

  v_code := public.generate_invite_code();

  INSERT INTO public.invites (teacher_id, code, status, expires_at, organization_id, target_role)
  VALUES (
    v_user_id,
    v_code,
    'pending',
    now() + (p_expires_in_days || ' days')::interval,
    v_org_id,
    p_target_role
  )
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'code', v_code,
    'expires_at', (now() + (p_expires_in_days || ' days')::interval),
    'target_role', p_target_role
  );
END;
$$;

COMMENT ON FUNCTION public.create_invite(int, public.org_role) IS '초대 코드 생성 (조직 + 대상 역할 지정)';

-- 10-B. use_invite_code: 조직 멤버십 + teacher_student 연결
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

  -- 3. 조직 멤버로 추가
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
    VALUES (v_org_id, v_user_id, v_invite.target_role, v_invite.teacher_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 4. student인 경우: teacher_student 연결
  IF v_invite.target_role = 'student' THEN
    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.teacher_student (teacher_id, student_id, organization_id)
      VALUES (v_invite.teacher_id, v_user_id, v_org_id)
      ON CONFLICT DO NOTHING;
    ELSE
      -- 하위 호환: org_id 없는 기존 초대
      INSERT INTO public.teacher_student (teacher_id, student_id, organization_id)
      SELECT v_invite.teacher_id, v_user_id, om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = v_invite.teacher_id AND om.role IN ('owner', 'teacher')
        AND om.deleted_at IS NULL
      LIMIT 1
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF v_invite.target_role = 'teacher' THEN
    -- teacher로 초대된 경우: users.role 업데이트 (하위 호환)
    UPDATE public.users SET role = 'teacher'
    WHERE id = v_user_id AND role = 'student' AND deleted_at IS NULL;
  END IF;

  -- 5. 알림: student_connected
  INSERT INTO public.notification_logs (user_id, type, title, body, data, created_by, resource_id)
  VALUES (
    v_invite.teacher_id,
    'student_connected',
    '새 학생 연결',
    (SELECT name FROM public.users WHERE id = v_user_id) || ' 학생이 연결되었습니다',
    jsonb_build_object(
      'student_id', v_user_id,
      'invite_id', v_invite.id
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

COMMENT ON FUNCTION public.use_invite_code IS '초대 코드 사용 (조직 멤버십 + teacher_student 연결 + 알림)';

-- ============================================================================
-- 11. UPDATED RPCs — 목록 조회 (org_id 필터)
-- ============================================================================

-- 11-A. get_teacher_students: org_id 기반 필터 추가
DROP FUNCTION IF EXISTS public.get_teacher_students();

CREATE OR REPLACE FUNCTION public.get_teacher_students(p_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  created_at timestamptz,
  scripts_count bigint,
  practices_count bigint,
  last_practice_at timestamptz,
  avg_score numeric,
  avg_reproduction_rate numeric,
  this_week_practices bigint,
  pending_feedback_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.name,
    ts.created_at,
    -- 스크립트 수
    (SELECT COUNT(*) FROM public.scripts s
     WHERE s.student_id = u.id AND s.teacher_id = v_user_id
       AND s.deleted_at IS NULL AND s.status = 'complete') AS scripts_count,
    -- 연습 수
    (SELECT COUNT(*) FROM public.practices p
     JOIN public.scripts s2 ON s2.id = p.script_id
     WHERE p.student_id = u.id AND s2.teacher_id = v_user_id
       AND p.deleted_at IS NULL AND s2.deleted_at IS NULL) AS practices_count,
    -- 마지막 연습
    (SELECT MAX(p2.created_at) FROM public.practices p2
     JOIN public.scripts s3 ON s3.id = p2.script_id
     WHERE p2.student_id = u.id AND s3.teacher_id = v_user_id
       AND p2.deleted_at IS NULL AND s3.deleted_at IS NULL) AS last_practice_at,
    -- 평균 점수
    (SELECT ROUND(AVG(p3.score)::numeric, 1) FROM public.practices p3
     JOIN public.scripts s4 ON s4.id = p3.script_id
     WHERE p3.student_id = u.id AND s4.teacher_id = v_user_id
       AND p3.deleted_at IS NULL AND s4.deleted_at IS NULL
       AND p3.score IS NOT NULL) AS avg_score,
    -- 평균 재현율
    (SELECT ROUND(AVG(p4.reproduction_rate)::numeric, 1) FROM public.practices p4
     JOIN public.scripts s5 ON s5.id = p4.script_id
     WHERE p4.student_id = u.id AND s5.teacher_id = v_user_id
       AND p4.deleted_at IS NULL AND s5.deleted_at IS NULL
       AND p4.reproduction_rate IS NOT NULL) AS avg_reproduction_rate,
    -- 이번 주 연습 수
    (SELECT COUNT(*) FROM public.practices p5
     JOIN public.scripts s6 ON s6.id = p5.script_id
     WHERE p5.student_id = u.id AND s6.teacher_id = v_user_id
       AND p5.deleted_at IS NULL AND s6.deleted_at IS NULL
       AND p5.created_at >= date_trunc('week', now())) AS this_week_practices,
    -- 피드백 대기 수
    (SELECT COUNT(*) FROM public.practices p6
     JOIN public.scripts s7 ON s7.id = p6.script_id
     WHERE p6.student_id = u.id AND s7.teacher_id = v_user_id
       AND p6.deleted_at IS NULL AND s7.deleted_at IS NULL
       AND p6.score IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.teacher_feedbacks tf
         WHERE tf.practice_id = p6.id AND tf.deleted_at IS NULL
       )) AS pending_feedback_count
  FROM public.teacher_student ts
  JOIN public.users u ON u.id = ts.student_id AND u.deleted_at IS NULL
  WHERE ts.teacher_id = v_user_id
    AND ts.deleted_at IS NULL
    AND (p_org_id IS NULL OR ts.organization_id = p_org_id)
  ORDER BY u.name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_teacher_students IS '강사의 학생 목록 + 통계 (조직 필터 선택적)';

-- 11-B. get_teacher_classes: org_id 기반 필터 추가
DROP FUNCTION IF EXISTS public.get_teacher_classes();

CREATE OR REPLACE FUNCTION public.get_teacher_classes(p_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  created_at timestamptz,
  updated_at timestamptz,
  member_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.created_at,
    c.updated_at,
    (SELECT COUNT(*) FROM public.class_members cm
     WHERE cm.class_id = c.id AND cm.deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM public.teacher_student ts
         WHERE ts.student_id = cm.student_id
           AND ts.teacher_id = v_user_id
           AND ts.deleted_at IS NULL
       )) AS member_count
  FROM public.classes c
  WHERE c.teacher_id = v_user_id
    AND c.deleted_at IS NULL
    AND (p_org_id IS NULL OR c.organization_id = p_org_id)
  ORDER BY c.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_teacher_classes IS '강사의 반 목록 (조직 필터 선택적)';

-- ============================================================================
-- 12. UPDATED RPCs — 역할 확인 + 권한 체크 변경
-- ============================================================================

-- 12-A. get_student_practice_stats: org 기반 권한 체크
-- (016에서 이미 plpgsql로 변환됨. role 체크를 org_member 체크로 변경)
DROP FUNCTION IF EXISTS public.get_student_practice_stats(uuid);
CREATE OR REPLACE FUNCTION public.get_student_practice_stats(p_student_id uuid)
RETURNS TABLE (
  total_practices bigint,
  total_duration_minutes bigint,
  avg_score numeric,
  avg_reproduction_rate numeric,
  this_week_practices bigint,
  last_practice_at timestamptz,
  prev_avg_score numeric,
  prev_avg_reproduction_rate numeric,
  target_opic_grade text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_self boolean;
  v_is_teacher boolean;
  v_is_admin boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  v_is_self := (v_caller_id = p_student_id);

  -- 연결된 강사인지 (org 기반 teacher_student)
  v_is_teacher := EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
  );

  -- super_admin
  v_is_admin := EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND (platform_role = 'super_admin' OR role = 'admin') AND deleted_at IS NULL
  );

  IF NOT (v_is_self OR v_is_teacher OR v_is_admin) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.practices p
     WHERE p.student_id = p_student_id AND p.deleted_at IS NULL) AS total_practices,
    (SELECT COALESCE(SUM(p2.duration_seconds), 0) / 60 FROM public.practices p2
     WHERE p2.student_id = p_student_id AND p2.deleted_at IS NULL) AS total_duration_minutes,
    (SELECT ROUND(AVG(p3.score)::numeric, 1) FROM public.practices p3
     WHERE p3.student_id = p_student_id AND p3.deleted_at IS NULL
       AND p3.score IS NOT NULL) AS avg_score,
    (SELECT ROUND(AVG(p4.reproduction_rate)::numeric, 1) FROM public.practices p4
     WHERE p4.student_id = p_student_id AND p4.deleted_at IS NULL
       AND p4.reproduction_rate IS NOT NULL) AS avg_reproduction_rate,
    (SELECT COUNT(*) FROM public.practices p5
     WHERE p5.student_id = p_student_id AND p5.deleted_at IS NULL
       AND p5.created_at >= date_trunc('week', now())) AS this_week_practices,
    (SELECT MAX(p6.created_at) FROM public.practices p6
     WHERE p6.student_id = p_student_id AND p6.deleted_at IS NULL) AS last_practice_at,
    -- 지난주 평균 점수 (7~14일 전)
    (SELECT ROUND(AVG(p7.score)::numeric, 1) FROM public.practices p7
     WHERE p7.student_id = p_student_id AND p7.deleted_at IS NULL
       AND p7.score IS NOT NULL
       AND p7.created_at >= now() - INTERVAL '14 days'
       AND p7.created_at < now() - INTERVAL '7 days') AS prev_avg_score,
    -- 지난주 평균 재현율
    (SELECT ROUND(AVG(p8.reproduction_rate)::numeric, 1) FROM public.practices p8
     WHERE p8.student_id = p_student_id AND p8.deleted_at IS NULL
       AND p8.reproduction_rate IS NOT NULL
       AND p8.created_at >= now() - INTERVAL '14 days'
       AND p8.created_at < now() - INTERVAL '7 days') AS prev_avg_reproduction_rate,
    -- 목표 등급 (첫 번째 연결에서)
    (SELECT ts.target_opic_grade FROM public.teacher_student ts
     WHERE ts.student_id = p_student_id AND ts.deleted_at IS NULL
     ORDER BY ts.created_at ASC LIMIT 1) AS target_opic_grade;
END;
$$;

COMMENT ON FUNCTION public.get_student_practice_stats IS '학생 연습 통계 (본인/연결 강사/super_admin)';

-- 12-B. get_student_topics_with_progress: org 기반 권한 체크
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

  -- 본인 또는 연결된 강사 또는 super_admin
  v_is_authorized := (v_caller_id = p_student_id)
    OR EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = v_caller_id AND (platform_role = 'super_admin' OR role = 'admin') AND deleted_at IS NULL
    );

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
       AND p2.deleted_at IS NULL AND s3.deleted_at IS NULL AND p2.score IS NOT NULL) AS best_avg_score,
    (SELECT MAX(p3.created_at) FROM public.practices p3
     JOIN public.scripts s4 ON s4.id = p3.script_id
     JOIN public.questions q5 ON q5.id = s4.question_id
     WHERE p3.student_id = p_student_id AND q5.topic_id = t.id
       AND p3.deleted_at IS NULL AND s4.deleted_at IS NULL) AS last_practice_at
  FROM public.student_topics st
  JOIN public.topics t ON t.id = st.topic_id AND t.is_active = true
  WHERE st.student_id = p_student_id AND st.deleted_at IS NULL
  ORDER BY t.sort_order ASC;
END;
$$;

COMMENT ON FUNCTION public.get_student_topics_with_progress IS '학생의 배정 토픽 + 진행 통계 (org 기반 권한)';

-- ============================================================================
-- 13. UPDATED RPCs — Admin 함수 (platform_role 기반)
-- ============================================================================

-- 13-A. get_admin_dashboard_stats: platform_role 체크
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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

  -- super_admin 또는 기존 admin 허용 (하위 호환)
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND (platform_role = 'super_admin' OR role = 'admin')
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'total_users', (SELECT COUNT(*) FROM public.users WHERE deleted_at IS NULL),
    'total_teachers', (SELECT COUNT(*) FROM public.users WHERE role = 'teacher' AND deleted_at IS NULL),
    'total_students', (SELECT COUNT(*) FROM public.users WHERE role = 'student' AND deleted_at IS NULL),
    'total_organizations', (SELECT COUNT(*) FROM public.organizations WHERE deleted_at IS NULL),
    'active_7d', (
      SELECT COUNT(DISTINCT p.student_id) FROM public.practices p
      WHERE p.created_at > now() - INTERVAL '7 days' AND p.deleted_at IS NULL
    ),
    'active_30d', (
      SELECT COUNT(DISTINCT p.student_id) FROM public.practices p
      WHERE p.created_at > now() - INTERVAL '30 days' AND p.deleted_at IS NULL
    ),
    'total_subscribers', (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active'),
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

-- 13-B. admin_list_users: platform_role 체크
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_page int DEFAULT 1,
  p_per_page int DEFAULT 20,
  p_search text DEFAULT NULL,
  p_role public.user_role DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_offset int;
  v_total bigint;
  v_users jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND (platform_role = 'super_admin' OR role = 'admin')
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  v_offset := (GREATEST(p_page, 1) - 1) * p_per_page;

  SELECT COUNT(*) INTO v_total
  FROM public.users u
  WHERE u.deleted_at IS NULL
    AND (p_role IS NULL OR u.role = p_role)
    AND (p_search IS NULL OR u.name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%');

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_users
  FROM (
    SELECT u.id, u.email, u.name, u.role, u.platform_role, u.created_at,
      (SELECT s.status FROM public.subscriptions s
       JOIN public.organization_members om ON om.user_id = u.id AND om.role = 'owner' AND om.deleted_at IS NULL
       WHERE s.organization_id = om.organization_id AND s.status = 'active'
       LIMIT 1) AS subscription_status,
      (SELECT sp.plan_key FROM public.subscriptions s2
       JOIN public.subscription_plans sp ON sp.id = s2.plan_id
       JOIN public.organization_members om2 ON om2.user_id = u.id AND om2.role = 'owner' AND om2.deleted_at IS NULL
       WHERE s2.organization_id = om2.organization_id AND s2.status = 'active'
       LIMIT 1) AS subscription_plan
    FROM public.users u
    WHERE u.deleted_at IS NULL
      AND (p_role IS NULL OR u.role = p_role)
      AND (p_search IS NULL OR u.name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%')
    ORDER BY u.created_at DESC
    LIMIT p_per_page OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'users', v_users,
    'total', v_total,
    'page', p_page,
    'per_page', p_per_page
  );
END;
$$;

-- 13-C. promote_to_teacher는 유지 (하위 호환) 하되 super_admin도 허용
CREATE OR REPLACE FUNCTION public.promote_to_teacher(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_target_role public.user_role;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- admin 또는 super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND (platform_role = 'super_admin' OR role = 'admin')
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADMIN_ONLY');
  END IF;

  SELECT role INTO v_target_role
  FROM public.users WHERE id = p_user_id AND deleted_at IS NULL;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF v_target_role = 'teacher' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_TEACHER');
  END IF;

  IF v_target_role = 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_CHANGE_ADMIN');
  END IF;

  UPDATE public.users SET role = 'teacher' WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

-- ============================================================================
-- 14. SCRIPTS/PRACTICES INSERT — org_id 자동 채우기 트리거
-- ============================================================================

-- scripts INSERT 시 organization_id 자동 채우기 (서비스에서 명시적으로 안 보낸 경우)
CREATE OR REPLACE FUNCTION public.auto_fill_script_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT ts.organization_id INTO NEW.organization_id
    FROM public.teacher_student ts
    WHERE ts.teacher_id = NEW.teacher_id
      AND ts.student_id = NEW.student_id
      AND ts.deleted_at IS NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_fill_script_org
  BEFORE INSERT ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_script_org_id();

-- practices INSERT 시 organization_id 자동 채우기
CREATE OR REPLACE FUNCTION public.auto_fill_practice_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT s.organization_id INTO NEW.organization_id
    FROM public.scripts s
    WHERE s.id = NEW.script_id AND s.deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_fill_practice_org
  BEFORE INSERT ON public.practices
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_practice_org_id();

-- ============================================================================
-- 15. create_class: org_id 추가
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_class(p_name text, p_description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_class_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLASS_NAME_REQUIRED');
  END IF;

  -- 발급자의 조직 조회
  SELECT om.organization_id INTO v_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id AND om.role IN ('owner', 'teacher') AND om.deleted_at IS NULL
  LIMIT 1;

  -- 같은 이름 중복 체크 (같은 강사 + 같은 조직)
  IF EXISTS (
    SELECT 1 FROM public.classes
    WHERE teacher_id = v_user_id AND name = trim(p_name) AND deleted_at IS NULL
      AND (v_org_id IS NULL OR organization_id = v_org_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLASS_NAME_DUPLICATE');
  END IF;

  INSERT INTO public.classes (teacher_id, name, description, organization_id)
  VALUES (v_user_id, trim(p_name), p_description, v_org_id)
  RETURNING id INTO v_class_id;

  RETURN jsonb_build_object('success', true, 'class_id', v_class_id);
END;
$$;

COMMENT ON FUNCTION public.create_class IS '반 생성 (조직 자동 연결)';

-- ============================================================================
-- DONE
-- ============================================================================
