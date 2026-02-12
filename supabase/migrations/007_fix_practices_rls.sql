-- ============================================================================
-- OPIc 학습 앱 - practices RLS 정책 수정
-- ============================================================================
-- 변경 사항:
-- 1. practices SELECT 정책: 스크립트 기반 → 연결된 학생 기반
-- 2. admin 조건 추가 (Phase 4 대비)
--
-- 이유:
-- - CLAUDE.md 권한 매트릭스: "teacher: 연결된 학생" 조회 가능
-- - 기존 정책은 "본인 작성 스크립트의 연습만" 조회 가능했음
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "practices_select" ON public.practices;

-- 새 정책: 연결된 학생 기반 조회
CREATE POLICY "practices_select" ON public.practices
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      -- 1. 학생 본인
      student_id = auth.uid()

      -- 2. 연결된 강사 (teacher_student 기반)
      OR EXISTS (
        SELECT 1 FROM public.teacher_student ts
        WHERE ts.teacher_id = auth.uid()
          AND ts.student_id = practices.student_id
          AND ts.deleted_at IS NULL
      )

      -- 3. Admin (Phase 4 대비)
      OR public.get_user_role(auth.uid()) = 'admin'
    )
  );

COMMENT ON POLICY "practices_select" ON public.practices IS
  '연습 기록 조회: 학생 본인 / 연결된 강사 / Admin';
