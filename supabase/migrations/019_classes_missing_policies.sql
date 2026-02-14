-- ============================================================================
-- 019: classes/class_members 누락된 RLS 정책 추가
-- ============================================================================
-- 배경: 014_classes.sql에서 classes DELETE, class_members UPDATE/DELETE 정책 누락
-- 현재 모든 변경은 SECURITY DEFINER RPC로 처리되어 실제 보안 위험은 없으나,
-- 방어적 보안 원칙(defense-in-depth)에 따라 RLS 정책을 완성함.
--
-- 추가 정책:
--   1. classes DELETE (강사 본인 반만)
--   2. class_members UPDATE (반 소유 강사만)
--   3. class_members DELETE (반 소유 강사만)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. classes DELETE 정책
-- --------------------------------------------------------------------------
-- 강사가 본인이 만든 반만 삭제 가능
CREATE POLICY "classes_delete_teacher" ON public.classes
  FOR DELETE USING (
    deleted_at IS NULL
    AND teacher_id = auth.uid()
  );

-- --------------------------------------------------------------------------
-- 2. class_members UPDATE 정책
-- --------------------------------------------------------------------------
-- 반 소유 강사만 멤버 정보 수정 가능 (soft delete 포함)
CREATE POLICY "class_members_update_teacher" ON public.class_members
  FOR UPDATE USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_members.class_id
        AND c.teacher_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );

-- --------------------------------------------------------------------------
-- 3. class_members DELETE 정책
-- --------------------------------------------------------------------------
-- 반 소유 강사만 멤버 삭제 가능
CREATE POLICY "class_members_delete_teacher" ON public.class_members
  FOR DELETE USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_members.class_id
        AND c.teacher_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );
