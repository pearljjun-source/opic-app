-- ============================================================================
-- OPIc 학습 앱 - Row Level Security (RLS) Policies
-- ============================================================================

-- ============================================================================
-- 1. RLS 활성화
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_student ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. USERS 정책
-- ============================================================================

-- SELECT: 본인 정보 + 연결된 사람 정보
CREATE POLICY "users_select_own_and_connected" ON public.users
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.teacher_student ts
      WHERE (ts.teacher_id = auth.uid() AND ts.student_id = users.id)
         OR (ts.student_id = auth.uid() AND ts.teacher_id = users.id)
    )
  );

-- UPDATE: 본인 정보만
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 3. INVITES 정책
-- ============================================================================

-- SELECT: 강사는 본인 것, 학생은 유효한 코드 조회용
CREATE POLICY "invites_select" ON public.invites
  FOR SELECT USING (
    teacher_id = auth.uid()
    OR (
      public.get_user_role(auth.uid()) = 'student'
      AND status = 'pending'
      AND expires_at > now()
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
    status = 'pending'
    AND expires_at > now()
    AND public.get_user_role(auth.uid()) = 'student'
  )
  WITH CHECK (
    used_by = auth.uid()
    AND status = 'used'
  );

-- DELETE: 강사가 본인 것만 삭제
CREATE POLICY "invites_delete_teacher" ON public.invites
  FOR DELETE USING (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
  );

-- ============================================================================
-- 4. TEACHER_STUDENT 정책
-- ============================================================================

-- SELECT: 본인이 포함된 연결만
CREATE POLICY "teacher_student_select" ON public.teacher_student
  FOR SELECT USING (
    teacher_id = auth.uid() OR student_id = auth.uid()
  );

-- DELETE: 강사 또는 학생이 연결 해제
CREATE POLICY "teacher_student_delete" ON public.teacher_student
  FOR DELETE USING (
    teacher_id = auth.uid() OR student_id = auth.uid()
  );

-- ============================================================================
-- 5. TOPICS 정책 (공개 읽기 전용)
-- ============================================================================

CREATE POLICY "topics_select_all" ON public.topics
  FOR SELECT USING (is_active = true);

-- ============================================================================
-- 6. QUESTIONS 정책 (공개 읽기 전용)
-- ============================================================================

CREATE POLICY "questions_select_all" ON public.questions
  FOR SELECT USING (is_active = true);

-- ============================================================================
-- 7. STUDENT_TOPICS 정책
-- ============================================================================

-- SELECT: 본인 것 + 연결된 강사가 조회
CREATE POLICY "student_topics_select" ON public.student_topics
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_connected_student(auth.uid(), student_id)
  );

-- INSERT: 학생이 본인 것만
CREATE POLICY "student_topics_insert" ON public.student_topics
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'student'
  );

-- DELETE: 학생이 본인 것만
CREATE POLICY "student_topics_delete" ON public.student_topics
  FOR DELETE USING (
    student_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'student'
  );

-- ============================================================================
-- 8. SCRIPTS 정책
-- ============================================================================

-- SELECT: 강사는 본인 작성, 학생은 본인 것
CREATE POLICY "scripts_select" ON public.scripts
  FOR SELECT USING (
    teacher_id = auth.uid()
    OR student_id = auth.uid()
  );

-- INSERT: 강사가 연결된 학생용만
CREATE POLICY "scripts_insert_teacher" ON public.scripts
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
    AND public.is_connected_student(auth.uid(), student_id)
  );

-- UPDATE: 강사가 본인 작성만
CREATE POLICY "scripts_update_teacher" ON public.scripts
  FOR UPDATE USING (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
  )
  WITH CHECK (teacher_id = auth.uid());

-- DELETE: 강사가 본인 작성만
CREATE POLICY "scripts_delete_teacher" ON public.scripts
  FOR DELETE USING (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
  );

-- ============================================================================
-- 9. SCRIPT_VIEWS 정책
-- ============================================================================

-- SELECT: 스크립트 접근 권한이 있는 사람
CREATE POLICY "script_views_select" ON public.script_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scripts s
      WHERE s.id = script_views.script_id
        AND (s.student_id = auth.uid() OR s.teacher_id = auth.uid())
    )
  );

-- INSERT: 학생이 본인 스크립트만
CREATE POLICY "script_views_insert" ON public.script_views
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scripts s
      WHERE s.id = script_views.script_id
        AND s.student_id = auth.uid()
    )
    AND public.get_user_role(auth.uid()) = 'student'
  );

-- ============================================================================
-- 10. PRACTICES 정책
-- ============================================================================

-- SELECT: 학생 본인 + 연결된 강사
CREATE POLICY "practices_select" ON public.practices
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.scripts s
      WHERE s.id = practices.script_id
        AND s.teacher_id = auth.uid()
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
        AND s.student_id = auth.uid()
    )
  );

-- ============================================================================
-- 11. TEACHER_FEEDBACKS 정책
-- ============================================================================

-- SELECT: 관련 practice 접근 권한 따름
CREATE POLICY "teacher_feedbacks_select" ON public.teacher_feedbacks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.practices p
      JOIN public.scripts s ON s.id = p.script_id
      WHERE p.id = teacher_feedbacks.practice_id
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
        AND s.teacher_id = auth.uid()
    )
  );

-- UPDATE: 강사가 본인 작성만
CREATE POLICY "teacher_feedbacks_update" ON public.teacher_feedbacks
  FOR UPDATE USING (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
  )
  WITH CHECK (teacher_id = auth.uid());

-- DELETE: 강사가 본인 작성만
CREATE POLICY "teacher_feedbacks_delete" ON public.teacher_feedbacks
  FOR DELETE USING (
    teacher_id = auth.uid()
    AND public.get_user_role(auth.uid()) = 'teacher'
  );

-- ============================================================================
-- 12. USER_CONSENTS 정책
-- ============================================================================

CREATE POLICY "user_consents_select" ON public.user_consents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_consents_insert" ON public.user_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_consents_update" ON public.user_consents
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 13. APP_CONFIG 정책 (공개 읽기 전용)
-- ============================================================================

CREATE POLICY "app_config_select_all" ON public.app_config
  FOR SELECT USING (true);

-- ============================================================================
-- 14. API_USAGE 정책
-- ============================================================================

-- SELECT: 본인만
CREATE POLICY "api_usage_select_own" ON public.api_usage
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: Service Role에서만 (Edge Function)

-- ============================================================================
-- 15. NOTIFICATION_LOGS 정책
-- ============================================================================

-- SELECT: 본인만
CREATE POLICY "notification_logs_select" ON public.notification_logs
  FOR SELECT USING (user_id = auth.uid());

-- UPDATE: 본인만 (읽음 처리)
CREATE POLICY "notification_logs_update" ON public.notification_logs
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
