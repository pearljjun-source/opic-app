-- ============================================================================
-- 010: 누락된 RLS 정책 추가
--
-- 수정 내용:
-- 1. practices UPDATE 정책 추가 (학생이 본인 연습 결과 업데이트)
-- 2. student_topics UPDATE 정책 추가 (학생이 본인 토픽 soft delete)
-- 3. student_topics UNIQUE 제약 조건 수정 (soft delete 호환)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. PRACTICES UPDATE 정책
--
-- 용도: 녹음 후 STT 결과, 점수, AI 피드백을 업데이트
-- 없으면: updatePracticeWithFeedback()가 silently fail
-- --------------------------------------------------------------------------
CREATE POLICY "practices_update_student" ON public.practices
  FOR UPDATE USING (
    deleted_at IS NULL
    AND student_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'student'
  )
  WITH CHECK (
    deleted_at IS NULL
    AND student_id = auth.uid()
  );

-- --------------------------------------------------------------------------
-- 2. STUDENT_TOPICS UPDATE 정책
--
-- 용도: 토픽 재설정 시 기존 선택을 soft delete (.update({ deleted_at }))
-- 006_soft_delete.sql에서 DELETE 정책만 DROP하고 UPDATE 정책을 추가하지 않아 누락됨
-- --------------------------------------------------------------------------
CREATE POLICY "student_topics_update" ON public.student_topics
  FOR UPDATE USING (
    deleted_at IS NULL
    AND student_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'student'
  )
  WITH CHECK (
    student_id = auth.uid()
  );

-- --------------------------------------------------------------------------
-- 3. STUDENT_TOPICS UNIQUE 제약 조건 수정
--
-- 문제: UNIQUE(student_id, topic_id)가 soft delete된 행과 충돌
-- 해결: 기존 UNIQUE 제거 → deleted_at IS NULL 조건부 인덱스로 대체
-- --------------------------------------------------------------------------
ALTER TABLE public.student_topics
  DROP CONSTRAINT IF EXISTS student_topics_student_id_topic_id_key;

CREATE UNIQUE INDEX student_topics_unique_active
  ON public.student_topics(student_id, topic_id)
  WHERE deleted_at IS NULL;
