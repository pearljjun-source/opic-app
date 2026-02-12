-- ============================================================================
-- OPIc 학습 앱 - Soft Delete 적용 & script_views 수정
-- ============================================================================
-- 변경 사항:
-- 1. 10개 테이블에 deleted_at 컬럼 추가
-- 2. script_views UNIQUE 제약 제거 (조회 이력 저장용)
-- 3. RLS 정책에 deleted_at IS NULL 조건 추가
-- 4. Soft Delete 함수 추가
-- ============================================================================

-- ============================================================================
-- 1. deleted_at 컬럼 추가
-- ============================================================================

-- users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_deleted ON public.users(deleted_at)
WHERE deleted_at IS NULL;

-- invites
ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_invites_deleted ON public.invites(deleted_at)
WHERE deleted_at IS NULL;

-- teacher_student
ALTER TABLE public.teacher_student
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_student_deleted ON public.teacher_student(deleted_at)
WHERE deleted_at IS NULL;

-- student_topics
ALTER TABLE public.student_topics
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_student_topics_deleted ON public.student_topics(deleted_at)
WHERE deleted_at IS NULL;

-- scripts
ALTER TABLE public.scripts
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_scripts_deleted ON public.scripts(deleted_at)
WHERE deleted_at IS NULL;

-- script_views
ALTER TABLE public.script_views
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_script_views_deleted ON public.script_views(deleted_at)
WHERE deleted_at IS NULL;

-- practices
ALTER TABLE public.practices
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_practices_deleted ON public.practices(deleted_at)
WHERE deleted_at IS NULL;

-- teacher_feedbacks
ALTER TABLE public.teacher_feedbacks
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_feedbacks_deleted ON public.teacher_feedbacks(deleted_at)
WHERE deleted_at IS NULL;

-- user_consents
ALTER TABLE public.user_consents
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_consents_deleted ON public.user_consents(deleted_at)
WHERE deleted_at IS NULL;

-- notification_logs
ALTER TABLE public.notification_logs
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_logs_deleted ON public.notification_logs(deleted_at)
WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. script_views UNIQUE 제약 제거 (조회 이력 저장용)
-- ============================================================================

-- 기존 UNIQUE 제약 삭제
ALTER TABLE public.script_views
DROP CONSTRAINT IF EXISTS script_views_script_id_key;

-- 조회 이력 조회용 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_script_views_script_viewed
ON public.script_views(script_id, viewed_at DESC)
WHERE deleted_at IS NULL;

-- 코멘트 업데이트
COMMENT ON TABLE public.script_views IS '학생이 스크립트를 확인한 기록 (조회할 때마다 INSERT)';

-- ============================================================================
-- 3. RLS 정책 재생성 (deleted_at IS NULL 조건 추가)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 3.1 USERS 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_own_and_connected" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- SELECT: 본인 정보 + 연결된 사람 정보 (삭제되지 않은 것만)
CREATE POLICY "users_select_own_and_connected" ON public.users
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      auth.uid() = id
      OR EXISTS (
        SELECT 1 FROM public.teacher_student ts
        WHERE ts.deleted_at IS NULL
          AND ((ts.teacher_id = auth.uid() AND ts.student_id = users.id)
               OR (ts.student_id = auth.uid() AND ts.teacher_id = users.id))
      )
    )
  );

-- UPDATE: 본인 정보만 (삭제되지 않은 것만)
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = id AND deleted_at IS NULL);

-- --------------------------------------------------------------------------
-- 3.2 INVITES 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "invites_select" ON public.invites;
DROP POLICY IF EXISTS "invites_insert_teacher" ON public.invites;
DROP POLICY IF EXISTS "invites_update_use" ON public.invites;
DROP POLICY IF EXISTS "invites_delete_teacher" ON public.invites;

-- SELECT: 강사는 본인 것, 학생은 유효한 코드 조회용
CREATE POLICY "invites_select" ON public.invites
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      teacher_id = auth.uid()
      OR (
        public.get_user_role(auth.uid()) = 'student'
        AND status = 'pending'
        AND expires_at > now()
      )
    )
  );

-- INSERT: 강사만 생성
CREATE POLICY "invites_insert_teacher" ON public.invites
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
  );

-- UPDATE: 학생이 코드 사용 시
CREATE POLICY "invites_update_use" ON public.invites
  FOR UPDATE USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND expires_at > now()
    AND public.get_user_role(auth.uid()) = 'student'
  )
  WITH CHECK (
    used_by = auth.uid()
    AND status = 'used'
  );

-- DELETE 정책 제거 (Soft Delete 사용)
-- 대신 UPDATE로 deleted_at 설정

-- --------------------------------------------------------------------------
-- 3.3 TEACHER_STUDENT 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "teacher_student_select" ON public.teacher_student;
DROP POLICY IF EXISTS "teacher_student_delete" ON public.teacher_student;

-- SELECT: 본인이 포함된 연결만 (삭제되지 않은 것만)
CREATE POLICY "teacher_student_select" ON public.teacher_student
  FOR SELECT USING (
    deleted_at IS NULL
    AND (teacher_id = auth.uid() OR student_id = auth.uid())
  );

-- --------------------------------------------------------------------------
-- 3.4 STUDENT_TOPICS 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "student_topics_select" ON public.student_topics;
DROP POLICY IF EXISTS "student_topics_insert" ON public.student_topics;
DROP POLICY IF EXISTS "student_topics_delete" ON public.student_topics;

-- SELECT: 본인 것 + 연결된 강사가 조회
CREATE POLICY "student_topics_select" ON public.student_topics
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      student_id = auth.uid()
      OR public.is_connected_student(auth.uid(), student_id)
    )
  );

-- INSERT: 학생이 본인 것만
CREATE POLICY "student_topics_insert" ON public.student_topics
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'student'
  );

-- --------------------------------------------------------------------------
-- 3.5 SCRIPTS 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "scripts_select" ON public.scripts;
DROP POLICY IF EXISTS "scripts_insert_teacher" ON public.scripts;
DROP POLICY IF EXISTS "scripts_update_teacher" ON public.scripts;
DROP POLICY IF EXISTS "scripts_delete_teacher" ON public.scripts;

-- SELECT: 강사는 본인 작성, 학생은 본인 것 (삭제되지 않은 것만)
CREATE POLICY "scripts_select" ON public.scripts
  FOR SELECT USING (
    deleted_at IS NULL
    AND (teacher_id = auth.uid() OR student_id = auth.uid())
  );

-- INSERT: 강사가 연결된 학생용만
CREATE POLICY "scripts_insert_teacher" ON public.scripts
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
    AND public.is_connected_student(auth.uid(), student_id)
  );

-- UPDATE: 강사가 본인 작성만 (삭제되지 않은 것만)
CREATE POLICY "scripts_update_teacher" ON public.scripts
  FOR UPDATE USING (
    deleted_at IS NULL
    AND teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
  )
  WITH CHECK (teacher_id = auth.uid());

-- --------------------------------------------------------------------------
-- 3.6 SCRIPT_VIEWS 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "script_views_select" ON public.script_views;
DROP POLICY IF EXISTS "script_views_insert" ON public.script_views;

-- SELECT: 스크립트 접근 권한이 있는 사람
CREATE POLICY "script_views_select" ON public.script_views
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.scripts s
      WHERE s.id = script_views.script_id
        AND s.deleted_at IS NULL
        AND (s.student_id = auth.uid() OR s.teacher_id = auth.uid())
    )
  );

-- INSERT: 학생이 본인 스크립트만 (UNIQUE 제거됨, 여러 번 INSERT 가능)
CREATE POLICY "script_views_insert" ON public.script_views
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scripts s
      WHERE s.id = script_views.script_id
        AND s.deleted_at IS NULL
        AND s.student_id = auth.uid()
    )
    AND public.get_user_role(auth.uid()) = 'student'
  );

-- --------------------------------------------------------------------------
-- 3.7 PRACTICES 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "practices_select" ON public.practices;
DROP POLICY IF EXISTS "practices_insert_student" ON public.practices;

-- SELECT: 학생 본인 + 연결된 강사 (삭제되지 않은 것만)
CREATE POLICY "practices_select" ON public.practices
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      student_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.scripts s
        WHERE s.id = practices.script_id
          AND s.deleted_at IS NULL
          AND s.teacher_id = auth.uid()
      )
    )
  );

-- INSERT: 학생이 본인 스크립트만
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
  );

-- --------------------------------------------------------------------------
-- 3.8 TEACHER_FEEDBACKS 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "teacher_feedbacks_select" ON public.teacher_feedbacks;
DROP POLICY IF EXISTS "teacher_feedbacks_insert" ON public.teacher_feedbacks;
DROP POLICY IF EXISTS "teacher_feedbacks_update" ON public.teacher_feedbacks;
DROP POLICY IF EXISTS "teacher_feedbacks_delete" ON public.teacher_feedbacks;

-- SELECT: 관련 practice 접근 권한 따름 (삭제되지 않은 것만)
CREATE POLICY "teacher_feedbacks_select" ON public.teacher_feedbacks
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.practices p
      JOIN public.scripts s ON s.id = p.script_id
      WHERE p.id = teacher_feedbacks.practice_id
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND (p.student_id = auth.uid() OR s.teacher_id = auth.uid())
    )
  );

-- INSERT: 강사가 연결된 학생의 practice만
CREATE POLICY "teacher_feedbacks_insert" ON public.teacher_feedbacks
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.practices p
      JOIN public.scripts s ON s.id = p.script_id
      WHERE p.id = teacher_feedbacks.practice_id
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND s.teacher_id = auth.uid()
    )
  );

-- UPDATE: 강사가 본인 작성만 (삭제되지 않은 것만)
CREATE POLICY "teacher_feedbacks_update" ON public.teacher_feedbacks
  FOR UPDATE USING (
    deleted_at IS NULL
    AND teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
  )
  WITH CHECK (teacher_id = auth.uid());

-- --------------------------------------------------------------------------
-- 3.9 USER_CONSENTS 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_consents_select" ON public.user_consents;
DROP POLICY IF EXISTS "user_consents_insert" ON public.user_consents;
DROP POLICY IF EXISTS "user_consents_update" ON public.user_consents;

CREATE POLICY "user_consents_select" ON public.user_consents
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "user_consents_insert" ON public.user_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_consents_update" ON public.user_consents
  FOR UPDATE USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- 3.10 NOTIFICATION_LOGS 정책 재생성
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "notification_logs_select" ON public.notification_logs;
DROP POLICY IF EXISTS "notification_logs_update" ON public.notification_logs;

CREATE POLICY "notification_logs_select" ON public.notification_logs
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "notification_logs_update" ON public.notification_logs
  FOR UPDATE USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 4. Soft Delete 함수들
-- ============================================================================

-- --------------------------------------------------------------------------
-- 4.1 사용자 Soft Delete (탈퇴)
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

  -- 연관 데이터도 Soft Delete (선택적 - 데이터 보존을 위해 남겨둘 수도 있음)
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

  -- 주의: scripts, practices, teacher_feedbacks는 보존
  -- (강사 탈퇴 시 학생 데이터가 사라지지 않도록)

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_user IS '사용자 탈퇴 (Soft Delete)';

-- --------------------------------------------------------------------------
-- 4.2 스크립트 Soft Delete
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_script(p_script_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_teacher_id uuid;
BEGIN
  v_caller_id := auth.uid();

  -- 스크립트 작성자 확인
  SELECT teacher_id INTO v_teacher_id
  FROM public.scripts
  WHERE id = p_script_id AND deleted_at IS NULL;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- 작성자만 삭제 가능
  IF v_caller_id != v_teacher_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- 스크립트 Soft Delete
  UPDATE public.scripts
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_script_id AND deleted_at IS NULL;

  -- 연관된 조회 기록도 Soft Delete
  UPDATE public.script_views
  SET deleted_at = now()
  WHERE script_id = p_script_id AND deleted_at IS NULL;

  -- 연관된 연습 기록도 Soft Delete
  UPDATE public.practices
  SET deleted_at = now()
  WHERE script_id = p_script_id AND deleted_at IS NULL;

  -- 연관된 강사 피드백도 Soft Delete
  UPDATE public.teacher_feedbacks
  SET deleted_at = now()
  WHERE practice_id IN (
    SELECT id FROM public.practices WHERE script_id = p_script_id
  ) AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_script IS '스크립트 삭제 (Soft Delete)';

-- --------------------------------------------------------------------------
-- 4.3 강사-학생 연결 해제 (Soft Delete)
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

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_connection IS '강사-학생 연결 해제 (Soft Delete)';

-- --------------------------------------------------------------------------
-- 4.4 학생 토픽 선택 해제 (Soft Delete)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_student_topic(p_student_topic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_student_id uuid;
BEGIN
  v_caller_id := auth.uid();

  -- 토픽 선택 정보 확인
  SELECT student_id INTO v_student_id
  FROM public.student_topics
  WHERE id = p_student_topic_id AND deleted_at IS NULL;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- 본인만 해제 가능
  IF v_caller_id != v_student_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- 토픽 선택 Soft Delete
  UPDATE public.student_topics
  SET deleted_at = now()
  WHERE id = p_student_topic_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.soft_delete_student_topic IS '학생 토픽 선택 해제 (Soft Delete)';

-- ============================================================================
-- 5. 스크립트 조회수 관련 함수
-- ============================================================================

-- 스크립트 조회수 조회 함수
CREATE OR REPLACE FUNCTION public.get_script_view_count(p_script_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.script_views
  WHERE script_id = p_script_id AND deleted_at IS NULL;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.get_script_view_count IS '스크립트 조회수 조회';

-- ============================================================================
-- 6. is_connected_student 함수 수정 (deleted_at 조건 추가)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_connected_student(
  p_teacher_id uuid,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teacher_student
    WHERE teacher_id = p_teacher_id
      AND student_id = p_student_id
      AND deleted_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.is_connected_student IS '강사-학생 연결 여부 확인 (Soft Delete 고려)';
