-- ============================================================================
-- OPIc 학습 앱 - 반(Class) 관리 시스템
-- ============================================================================
-- 변경 사항:
-- 1. classes, class_members 테이블 생성
-- 2. 인덱스 + 부분 유니크 인덱스
-- 3. RLS 정책
-- 4. RPC 함수 7개 (CRUD + 멤버 관리)
-- 5. 기존 soft_delete 함수 수정 (cascade)
-- ============================================================================

-- ============================================================================
-- 1. 테이블 생성
-- ============================================================================

-- 강사가 생성하는 반 (예: 월요일 초급반, 수요일 중급반)
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.users(id),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.classes IS '강사가 생성한 반/클래스';

-- 반-학생 M:N 관계 (학생은 여러 반에 소속 가능)
CREATE TABLE public.class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id),
  student_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(class_id, student_id)
);

COMMENT ON TABLE public.class_members IS '반에 소속된 학생 (M:N 관계)';

-- ============================================================================
-- 2. 인덱스
-- ============================================================================

CREATE INDEX idx_classes_teacher ON public.classes(teacher_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_members_class ON public.class_members(class_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_members_student ON public.class_members(student_id) WHERE deleted_at IS NULL;

-- 같은 강사가 같은 이름의 반 중복 생성 방지 (부분 유니크 인덱스)
CREATE UNIQUE INDEX unique_class_name_per_teacher
ON public.classes(teacher_id, name)
WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. 트리거
-- ============================================================================

-- classes.updated_at 자동 갱신 (handle_updated_at 재사용)
CREATE TRIGGER on_classes_updated
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. RLS 정책
-- ============================================================================

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- classes 정책
-- --------------------------------------------------------------------------

-- SELECT: 본인이 만든 반 OR 본인이 소속된 반
CREATE POLICY "classes_select" ON public.classes
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      teacher_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.class_members cm
        WHERE cm.class_id = classes.id
          AND cm.student_id = auth.uid()
          AND cm.deleted_at IS NULL
      )
    )
  );

-- INSERT: teacher만, teacher_id = auth.uid()
CREATE POLICY "classes_insert_teacher" ON public.classes
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
  );

-- UPDATE: 본인이 만든 반만
CREATE POLICY "classes_update_teacher" ON public.classes
  FOR UPDATE USING (
    deleted_at IS NULL
    AND teacher_id = auth.uid()
  )
  WITH CHECK (teacher_id = auth.uid());

-- --------------------------------------------------------------------------
-- class_members 정책
-- --------------------------------------------------------------------------

-- SELECT: 반 소유 강사 OR 해당 학생 본인
CREATE POLICY "class_members_select" ON public.class_members
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      student_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_members.class_id
          AND c.teacher_id = auth.uid()
          AND c.deleted_at IS NULL
      )
    )
  );

-- INSERT: 반 소유 강사만
CREATE POLICY "class_members_insert_teacher" ON public.class_members
  FOR INSERT WITH CHECK (
    public.get_user_role(auth.uid()) = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_members.class_id
        AND c.teacher_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 5. RPC 함수
-- ============================================================================

-- --------------------------------------------------------------------------
-- 5.1 반 생성
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_class(
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_class_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role INTO v_user_role FROM public.users
  WHERE id = v_user_id AND deleted_at IS NULL;

  IF v_user_role IS NULL OR v_user_role != 'teacher' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_TEACHER');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLASS_NAME_REQUIRED');
  END IF;

  INSERT INTO public.classes (teacher_id, name, description)
  VALUES (v_user_id, trim(p_name), p_description)
  RETURNING id INTO v_class_id;

  RETURN jsonb_build_object('success', true, 'class_id', v_class_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLASS_NAME_DUPLICATE');
END;
$$;

COMMENT ON FUNCTION public.create_class IS '반 생성 (강사 전용)';

-- --------------------------------------------------------------------------
-- 5.2 반 수정
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_class(
  p_class_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_teacher_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT teacher_id INTO v_teacher_id FROM public.classes
  WHERE id = p_class_id AND deleted_at IS NULL;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_user_id != v_teacher_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  UPDATE public.classes
  SET
    name = COALESCE(NULLIF(trim(p_name), ''), name),
    description = COALESCE(p_description, description)
  WHERE id = p_class_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLASS_NAME_DUPLICATE');
END;
$$;

COMMENT ON FUNCTION public.update_class IS '반 수정 (소유 강사 전용)';

-- --------------------------------------------------------------------------
-- 5.3 반 삭제 (soft delete + 멤버십 cascade)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_class(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_teacher_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT teacher_id INTO v_teacher_id FROM public.classes
  WHERE id = p_class_id AND deleted_at IS NULL;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_user_id != v_teacher_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- 반 soft delete
  UPDATE public.classes SET deleted_at = now()
  WHERE id = p_class_id AND deleted_at IS NULL;

  -- 멤버십 일괄 soft delete
  UPDATE public.class_members SET deleted_at = now()
  WHERE class_id = p_class_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_class IS '반 삭제 + 멤버십 cascade (Soft Delete)';

-- --------------------------------------------------------------------------
-- 5.4 반에 학생 추가
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_class_member(
  p_class_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_teacher_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 반 소유권 검증
  SELECT teacher_id INTO v_teacher_id FROM public.classes
  WHERE id = p_class_id AND deleted_at IS NULL;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_user_id != v_teacher_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- teacher_student 연결 검증 (미연결 학생 추가 불가)
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = v_user_id
      AND student_id = p_student_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  -- ON CONFLICT: soft-deleted 멤버 재활성화 (UNIQUE + Soft Delete 해결)
  INSERT INTO public.class_members (class_id, student_id)
  VALUES (p_class_id, p_student_id)
  ON CONFLICT (class_id, student_id) DO UPDATE SET deleted_at = NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.add_class_member IS '반에 학생 추가 (teacher_student 연결 필수)';

-- --------------------------------------------------------------------------
-- 5.5 반에서 학생 제외
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_class_member(
  p_class_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_teacher_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT teacher_id INTO v_teacher_id FROM public.classes
  WHERE id = p_class_id AND deleted_at IS NULL;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_user_id != v_teacher_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  UPDATE public.class_members SET deleted_at = now()
  WHERE class_id = p_class_id
    AND student_id = p_student_id
    AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.remove_class_member IS '반에서 학생 제외 (Soft Delete)';

-- --------------------------------------------------------------------------
-- 5.6 강사의 반 목록 조회
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_teacher_classes()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  created_at timestamptz,
  updated_at timestamptz,
  member_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.created_at,
    c.updated_at,
    COALESCE(
      (SELECT COUNT(*) FROM public.class_members cm
       WHERE cm.class_id = c.id AND cm.deleted_at IS NULL),
      0
    ) AS member_count
  FROM public.classes c
  WHERE c.teacher_id = v_teacher_id
    AND c.deleted_at IS NULL
  ORDER BY c.name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_teacher_classes IS '강사의 반 목록 + 학생 수';

-- --------------------------------------------------------------------------
-- 5.7 반 상세 조회 (멤버 목록 + stats)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_class_detail(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_id uuid;
  v_class record;
  v_members jsonb;
BEGIN
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_class FROM public.classes
  WHERE id = p_class_id AND deleted_at IS NULL;

  IF v_class IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_class.teacher_id != v_teacher_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- 멤버 목록 + stats (get_teacher_students와 동일한 stats 패턴)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'email', u.email,
      'scripts_count', COALESCE(
        (SELECT COUNT(*) FROM public.scripts s
         WHERE s.student_id = u.id
           AND s.teacher_id = v_teacher_id
           AND s.deleted_at IS NULL), 0),
      'practices_count', COALESCE(
        (SELECT COUNT(*) FROM public.practices p
         WHERE p.student_id = u.id
           AND p.deleted_at IS NULL), 0),
      'last_practice_at', (SELECT MAX(p.created_at) FROM public.practices p
         WHERE p.student_id = u.id AND p.deleted_at IS NULL),
      'avg_score', (SELECT ROUND(AVG(p.score)::numeric, 1) FROM public.practices p
         WHERE p.student_id = u.id AND p.deleted_at IS NULL AND p.score IS NOT NULL),
      'avg_reproduction_rate', (SELECT ROUND(AVG(p.reproduction_rate)::numeric, 1) FROM public.practices p
         WHERE p.student_id = u.id AND p.deleted_at IS NULL AND p.reproduction_rate IS NOT NULL)
    ) ORDER BY u.name ASC
  ), '[]'::jsonb) INTO v_members
  FROM public.class_members cm
  INNER JOIN public.users u ON u.id = cm.student_id AND u.deleted_at IS NULL
  WHERE cm.class_id = p_class_id AND cm.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.teacher_student ts
      WHERE ts.student_id = cm.student_id
        AND ts.teacher_id = v_teacher_id
        AND ts.deleted_at IS NULL
    );

  RETURN jsonb_build_object(
    'success', true,
    'class', jsonb_build_object(
      'id', v_class.id,
      'name', v_class.name,
      'description', v_class.description,
      'created_at', v_class.created_at,
      'updated_at', v_class.updated_at
    ),
    'members', v_members
  );
END;
$$;

COMMENT ON FUNCTION public.get_class_detail IS '반 상세 정보 + 멤버 목록(stats 포함)';

-- ============================================================================
-- 6. 기존 함수 수정 (CASCADE)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 6.1 soft_delete_connection 수정: 연결 해제 시 학생을 강사의 반에서도 제거
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_connection(p_connection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_teacher_id uuid;
  v_student_id uuid;
BEGIN
  v_caller_id := auth.uid();

  -- 연결 정보 확인
  SELECT teacher_id, student_id INTO v_teacher_id, v_student_id
  FROM public.teacher_student
  WHERE id = p_connection_id AND deleted_at IS NULL;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- 강사 또는 학생만 해제 가능
  IF v_caller_id != v_teacher_id AND v_caller_id != v_student_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- 연결 Soft Delete
  UPDATE public.teacher_student
  SET deleted_at = now()
  WHERE id = p_connection_id AND deleted_at IS NULL;

  -- [NEW] 해당 학생을 강사의 모든 반에서 제거
  UPDATE public.class_members SET deleted_at = now()
  WHERE student_id = v_student_id
    AND class_id IN (
      SELECT id FROM public.classes
      WHERE teacher_id = v_teacher_id AND deleted_at IS NULL
    )
    AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_connection IS '강사-학생 연결 해제 + 반 멤버십 cascade (Soft Delete)';

-- --------------------------------------------------------------------------
-- 6.2 soft_delete_user 수정: 계정 삭제 시 classes, class_members cascade
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();

  -- 본인만 탈퇴 가능
  IF v_caller_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- 사용자 Soft Delete
  UPDATE public.users
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_user_id AND deleted_at IS NULL;

  -- 사용자 동의 기록
  UPDATE public.user_consents
  SET deleted_at = now()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- 알림 로그
  UPDATE public.notification_logs
  SET deleted_at = now()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- 강사-학생 연결 (양쪽 모두)
  UPDATE public.teacher_student
  SET deleted_at = now()
  WHERE (teacher_id = p_user_id OR student_id = p_user_id) AND deleted_at IS NULL;

  -- 초대 코드 (강사인 경우)
  UPDATE public.invites
  SET deleted_at = now()
  WHERE teacher_id = p_user_id AND deleted_at IS NULL;

  -- 학생 토픽 (학생인 경우)
  UPDATE public.student_topics
  SET deleted_at = now()
  WHERE student_id = p_user_id AND deleted_at IS NULL;

  -- [NEW] 강사인 경우: 본인이 만든 반 + 반 멤버십 삭제
  UPDATE public.classes SET deleted_at = now()
  WHERE teacher_id = p_user_id AND deleted_at IS NULL;

  UPDATE public.class_members SET deleted_at = now()
  WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = p_user_id)
    AND deleted_at IS NULL;

  -- [NEW] 학생인 경우: 본인의 반 멤버십 삭제
  UPDATE public.class_members SET deleted_at = now()
  WHERE student_id = p_user_id AND deleted_at IS NULL;

  -- 주의: scripts, practices, teacher_feedbacks는 보존
  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_user IS '사용자 탈퇴 + classes/class_members cascade (Soft Delete)';
