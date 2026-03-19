-- ============================================================================
-- 057: 조직 단위 데이터 격리 RLS 강화
-- ============================================================================
-- 보안 감사에서 발견된 3가지 CRITICAL 이슈 수정:
--
-- CRITICAL-1: teacher_student RLS에 organization_id 필터 누락
--   → 다중 조직 소속 강사가 다른 조직 학생 데이터 접근 가능
--
-- CRITICAL-2: organization_members DELETE 정책 누락
--   → RPC 이외 경로로 멤버 삭제 시 방어 계층 부재
--
-- CRITICAL-3: scripts/practices/exam_sessions/classes RLS에 organization_id 필터 누락
--   → 조직 간 데이터 격리 불완전
--
-- 근본 원인: 조직 시스템(020)이 기존 RLS(003~013) 이후 추가되었으나
--           기존 정책을 조직 기반으로 소급 업데이트하지 않음
--
-- 해결: SECURITY DEFINER 헬퍼 함수 + 모든 SELECT 정책에 조직 필터 추가
-- ============================================================================

-- ============================================================================
-- 1. 헬퍼 함수: 현재 사용자의 소속 조직 ID 목록
-- ============================================================================
-- SECURITY DEFINER: organization_members RLS를 bypass하여 순환 의존 방지
-- STABLE: 동일 트랜잭션 내 결과 캐싱 (성능)

CREATE OR REPLACE FUNCTION public._user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL;
$$;

-- ============================================================================
-- 2. CRITICAL-1: teacher_student SELECT에 조직 필터 추가
-- ============================================================================
-- 기존: teacher_id = auth.uid() OR student_id = auth.uid()
-- 수정: + organization_id가 사용자 소속 조직에 포함

DROP POLICY IF EXISTS "teacher_student_select" ON public.teacher_student;
CREATE POLICY "teacher_student_select" ON public.teacher_student
  FOR SELECT USING (
    deleted_at IS NULL
    AND (teacher_id = auth.uid() OR student_id = auth.uid())
    AND organization_id IN (SELECT public._user_org_ids())
  );

-- teacher_student INSERT도 조직 검증 추가
DROP POLICY IF EXISTS "teacher_student_insert" ON public.teacher_student;
CREATE POLICY "teacher_student_insert" ON public.teacher_student
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND organization_id IN (SELECT public._user_org_ids())
  );

-- teacher_student UPDATE (soft delete 등)
DROP POLICY IF EXISTS "teacher_student_update" ON public.teacher_student;
CREATE POLICY "teacher_student_update" ON public.teacher_student
  FOR UPDATE USING (
    deleted_at IS NULL
    AND teacher_id = auth.uid()
    AND organization_id IN (SELECT public._user_org_ids())
  );

-- ============================================================================
-- 3. CRITICAL-2: organization_members DELETE 정책 추가
-- ============================================================================
-- INSERT: WITH CHECK (false) — RPC 전용 (기존 유지)
-- DELETE: owner만 가능 (방어 계층)

CREATE POLICY "org_members_delete_owner"
  ON public.organization_members
  FOR DELETE USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id, ARRAY['owner']::public.org_role[])
  );

-- ============================================================================
-- 4. CRITICAL-3a: scripts RLS에 조직 필터 추가
-- ============================================================================
-- organization_id는 nullable (레거시 데이터)
-- → NULL인 경우 기존 uid 기반 정책으로 폴백 (하위 호환)

DROP POLICY IF EXISTS "scripts_select" ON public.scripts;
CREATE POLICY "scripts_select" ON public.scripts
  FOR SELECT USING (
    deleted_at IS NULL
    AND (teacher_id = auth.uid() OR student_id = auth.uid())
    AND (
      organization_id IS NULL  -- 레거시 데이터 폴백
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

-- scripts INSERT (기존 is_connected_student 유지 + 조직 필터)
DROP POLICY IF EXISTS "scripts_insert_teacher" ON public.scripts;
CREATE POLICY "scripts_insert_teacher" ON public.scripts
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
    AND public.is_connected_student(auth.uid(), student_id)
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

-- scripts UPDATE (teacher) — 조직 필터 추가
DROP POLICY IF EXISTS "scripts_update_teacher" ON public.scripts;
CREATE POLICY "scripts_update_teacher" ON public.scripts
  FOR UPDATE USING (
    deleted_at IS NULL
    AND teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  )
  WITH CHECK (teacher_id = auth.uid());

-- scripts UPDATE (student) — 기존 051 정책에 조직 필터 추가
DROP POLICY IF EXISTS "scripts_update_student" ON public.scripts;
CREATE POLICY "scripts_update_student" ON public.scripts
  FOR UPDATE USING (
    deleted_at IS NULL
    AND student_id = auth.uid()
    AND status = 'complete'
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  )
  WITH CHECK (student_id = auth.uid());

-- scripts DELETE (soft delete)
DROP POLICY IF EXISTS "scripts_delete_teacher" ON public.scripts;
CREATE POLICY "scripts_delete_teacher" ON public.scripts
  FOR DELETE USING (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

-- ============================================================================
-- 5. CRITICAL-3b: practices RLS에 조직 필터 추가
-- ============================================================================
-- 기존: teacher_student 서브쿼리로 간접 필터
-- 수정: 직접 organization_id 검증 추가

DROP POLICY IF EXISTS "practices_select" ON public.practices;
CREATE POLICY "practices_select" ON public.practices
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      student_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.teacher_student ts
        WHERE ts.teacher_id = auth.uid()
          AND ts.student_id = practices.student_id
          AND ts.deleted_at IS NULL
      )
      OR public.is_super_admin()
    )
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

-- practices INSERT — 조직 필터 추가
DROP POLICY IF EXISTS "practices_insert_student" ON public.practices;
CREATE POLICY "practices_insert_student" ON public.practices
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'student'
    AND EXISTS (
      SELECT 1 FROM public.scripts s
      WHERE s.id = practices.script_id
        AND s.deleted_at IS NULL
        AND s.student_id = auth.uid()
    )
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

-- practices UPDATE — 조직 필터 추가
DROP POLICY IF EXISTS "practices_update_student" ON public.practices;
CREATE POLICY "practices_update_student" ON public.practices
  FOR UPDATE USING (
    deleted_at IS NULL
    AND student_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'student'
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND student_id = auth.uid()
  );

-- ============================================================================
-- 6. CRITICAL-3c: exam_sessions RLS에 조직 필터 추가
-- ============================================================================

DROP POLICY IF EXISTS "exam_sessions_select_own" ON public.exam_sessions;
CREATE POLICY "exam_sessions_select_own"
  ON public.exam_sessions FOR SELECT
  USING (
    auth.uid() = student_id
    AND deleted_at IS NULL
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

DROP POLICY IF EXISTS "exam_sessions_select_teacher" ON public.exam_sessions;
CREATE POLICY "exam_sessions_select_teacher"
  ON public.exam_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_student ts
      WHERE ts.teacher_id = auth.uid()
        AND ts.student_id = exam_sessions.student_id
        AND ts.deleted_at IS NULL
    )
    AND deleted_at IS NULL
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

DROP POLICY IF EXISTS "exam_sessions_insert_own" ON public.exam_sessions;
CREATE POLICY "exam_sessions_insert_own"
  ON public.exam_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

DROP POLICY IF EXISTS "exam_sessions_update_own" ON public.exam_sessions;
CREATE POLICY "exam_sessions_update_own"
  ON public.exam_sessions FOR UPDATE
  USING (
    auth.uid() = student_id
    AND deleted_at IS NULL
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

-- ============================================================================
-- 7. CRITICAL-3d: classes RLS에 조직 필터 추가
-- ============================================================================

DROP POLICY IF EXISTS "classes_select" ON public.classes;
CREATE POLICY "classes_select" ON public.classes
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      teacher_id = auth.uid()
      OR public._is_class_member(id)
    )
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

-- classes INSERT — 조직 필터 추가
DROP POLICY IF EXISTS "classes_insert" ON public.classes;
CREATE POLICY "classes_insert" ON public.classes
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

-- classes UPDATE — 조직 필터 추가
DROP POLICY IF EXISTS "classes_update_teacher" ON public.classes;
CREATE POLICY "classes_update_teacher" ON public.classes
  FOR UPDATE USING (
    deleted_at IS NULL
    AND teacher_id = auth.uid()
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  )
  WITH CHECK (teacher_id = auth.uid());

-- classes DELETE (soft delete) — 조직 필터 추가
DROP POLICY IF EXISTS "classes_delete_teacher" ON public.classes;
CREATE POLICY "classes_delete_teacher" ON public.classes
  FOR DELETE USING (
    teacher_id = auth.uid()
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public._user_org_ids())
    )
  );

-- ============================================================================
-- 8. teacher_feedbacks — scripts 경유 간접 접근이므로 organization_id 직접 없음
--    scripts RLS가 강화되었으므로 간접적으로 보호됨 (변경 불필요)
-- ============================================================================

-- ============================================================================
-- 9. exam_responses — exam_sessions 경유 접근 (organization_id 직접 없음)
--    exam_sessions RLS가 강화되었으므로 간접적으로 보호됨 (변경 불필요)
-- ============================================================================

-- ============================================================================
-- 10. 슈퍼 관리자 전체 접근 정책 (기존 누락분)
-- ============================================================================
-- 슈퍼 관리자는 모든 조직 데이터에 접근 가능해야 함
-- _user_org_ids()는 소속 조직만 반환하므로, 별도 정책으로 처리

-- teacher_student: 슈퍼 관리자
DROP POLICY IF EXISTS "teacher_student_select_admin" ON public.teacher_student;
CREATE POLICY "teacher_student_select_admin" ON public.teacher_student
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.is_super_admin()
  );

-- scripts: 슈퍼 관리자
DROP POLICY IF EXISTS "scripts_select_admin" ON public.scripts;
CREATE POLICY "scripts_select_admin" ON public.scripts
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.is_super_admin()
  );

-- classes: 슈퍼 관리자
DROP POLICY IF EXISTS "classes_select_admin" ON public.classes;
CREATE POLICY "classes_select_admin" ON public.classes
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.is_super_admin()
  );

-- exam_sessions: 슈퍼 관리자
DROP POLICY IF EXISTS "exam_sessions_select_admin" ON public.exam_sessions;
CREATE POLICY "exam_sessions_select_admin" ON public.exam_sessions
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.is_super_admin()
  );
