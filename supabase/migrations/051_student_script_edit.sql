-- ============================================================================
-- 051: 학생 스크립트 수정 권한
-- ============================================================================
-- 변경 내용:
--   1. scripts 테이블에 학생 UPDATE RLS 정책 추가
--   2. 학생 수정 시 content만 변경 가능하도록 컬럼 보호 트리거
-- ============================================================================

-- 1. 학생 UPDATE RLS 정책
-- 기존 scripts_update_teacher (teacher_id = auth.uid()) 와 병렬로 동작
-- PostgreSQL RLS: 같은 operation의 여러 정책은 OR로 평가됨
CREATE POLICY "scripts_update_student" ON public.scripts
  FOR UPDATE USING (
    deleted_at IS NULL
    AND student_id = auth.uid()
    AND status = 'complete'
  )
  WITH CHECK (student_id = auth.uid());

COMMENT ON POLICY "scripts_update_student" ON public.scripts
  IS '학생이 본인에게 할당된 완료 스크립트의 content를 수정할 수 있음 (컬럼 보호 트리거와 함께 사용)';

-- 2. 학생 수정 시 컬럼 보호 트리거
-- protect_user_columns 패턴 적용: 학생은 content + updated_at만 변경 가능
-- content_ko는 기존 trg_reset_content_ko가 자동 리셋 처리
CREATE OR REPLACE FUNCTION public.protect_script_student_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- 서버(SECURITY DEFINER)는 제한 없음
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 강사 본인 스크립트면 기존 동작 유지 (제한 없음)
  IF auth.uid() = OLD.teacher_id THEN
    RETURN NEW;
  END IF;

  -- 학생인 경우: content + updated_at만 변경 허용, 나머지 컬럼 원복
  IF auth.uid() = OLD.student_id THEN
    NEW.teacher_id      := OLD.teacher_id;
    NEW.student_id      := OLD.student_id;
    NEW.question_id     := OLD.question_id;
    NEW.comment         := OLD.comment;
    NEW.status          := OLD.status;
    NEW.organization_id := OLD.organization_id;
    NEW.created_at      := OLD.created_at;
    NEW.deleted_at      := OLD.deleted_at;
    -- content: 학생 변경 허용
    -- content_ko: trg_reset_content_ko가 처리 (content 변경 시 자동 NULL)
    -- updated_at: 학생 변경 허용
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_script_student_update
  BEFORE UPDATE ON public.scripts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_script_student_update();

COMMENT ON FUNCTION public.protect_script_student_update()
  IS '학생의 스크립트 수정 시 content, updated_at만 변경 가능하도록 보호 (protect_user_columns 패턴)';
