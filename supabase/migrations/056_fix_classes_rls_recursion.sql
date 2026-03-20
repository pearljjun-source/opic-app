-- ============================================================================
-- 056: classes ↔ class_members RLS 무한 재귀 수정
-- ============================================================================
-- 문제: classes_select → class_members 서브쿼리 → class_members_select → classes 서브쿼리
--       PostgREST 임베딩 조인 (invites → classes) 시 42P17 infinite recursion 발생
--
-- 근본 원인: 양방향 RLS 정책이 서로를 참조하는 순환 의존
--   - classes_select: "이 반의 멤버인가?" → class_members SELECT (RLS 적용)
--   - class_members_select: "이 반의 소유 강사인가?" → classes SELECT (RLS 적용)
--
-- 해결: SECURITY DEFINER 헬퍼 함수로 RLS 없이 소유권 확인
--   - _is_class_teacher(class_id): classes 테이블 직접 조회 (RLS bypass)
--   - _is_class_member(class_id): class_members 테이블 직접 조회 (RLS bypass)
--   - 두 RLS 정책을 헬퍼 함수 기반으로 재작성 → 순환 의존 제거
-- ============================================================================

-- 1. 헬퍼 함수: 해당 반의 강사인지 확인 (RLS bypass)
CREATE OR REPLACE FUNCTION public._is_class_teacher(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id
      AND teacher_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

-- 2. 헬퍼 함수: 해당 반의 멤버(학생)인지 확인 (RLS bypass)
CREATE OR REPLACE FUNCTION public._is_class_member(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = p_class_id
      AND student_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

-- 3. classes_select 정책 재작성: class_members 직접 참조 → _is_class_member() 사용
DROP POLICY IF EXISTS "classes_select" ON public.classes;
CREATE POLICY "classes_select" ON public.classes
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      teacher_id = auth.uid()
      OR public._is_class_member(id)
    )
  );

-- 4. class_members_select 정책 재작성: classes 직접 참조 → _is_class_teacher() 사용
DROP POLICY IF EXISTS "class_members_select" ON public.class_members;
CREATE POLICY "class_members_select" ON public.class_members
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      student_id = auth.uid()
      OR public._is_class_teacher(class_id)
    )
  );

-- 5. class_members INSERT 정책도 동일 패턴 적용 (classes 직접 참조 제거)
DROP POLICY IF EXISTS "class_members_insert_teacher" ON public.class_members;
CREATE POLICY "class_members_insert_teacher" ON public.class_members
  FOR INSERT WITH CHECK (
    public.get_user_role(auth.uid()) = 'teacher'
    AND public._is_class_teacher(class_id)
  );

-- 6. class_members UPDATE/DELETE 정책도 확인 (019에서 생성)
-- 019_classes_missing_policies.sql의 UPDATE/DELETE도 classes 직접 참조
DROP POLICY IF EXISTS "class_members_update_teacher" ON public.class_members;
CREATE POLICY "class_members_update_teacher" ON public.class_members
  FOR UPDATE USING (
    public._is_class_teacher(class_id)
  )
  WITH CHECK (
    public._is_class_teacher(class_id)
  );

DROP POLICY IF EXISTS "class_members_delete_teacher" ON public.class_members;
CREATE POLICY "class_members_delete_teacher" ON public.class_members
  FOR DELETE USING (
    public._is_class_teacher(class_id)
  );
