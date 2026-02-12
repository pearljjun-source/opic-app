-- ============================================================================
-- OPIc 학습 앱 - Storage Buckets & Policies
-- ============================================================================

-- ============================================================================
-- 1. STORAGE BUCKETS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 녹음 파일 버킷 (Private)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'practice-recordings',
  'practice-recordings',
  false,
  52428800,  -- 50MB
  ARRAY['audio/m4a', 'audio/mp4', 'audio/wav', 'audio/mpeg', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1.2 TTS 캐시 버킷 (Public)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-audio',
  'question-audio',
  true,
  10485760,  -- 10MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. STORAGE POLICIES - practice-recordings
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 학생: 본인 폴더에 업로드
-- 파일 경로: {user_id}/{practice_id}.m4a
-- ----------------------------------------------------------------------------
CREATE POLICY "recordings_insert_own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'practice-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ----------------------------------------------------------------------------
-- 2.2 학생: 본인 파일 조회 + 강사: 연결된 학생 파일 조회
-- ----------------------------------------------------------------------------
CREATE POLICY "recordings_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'practice-recordings'
  AND (
    -- 본인 파일
    auth.uid()::text = (storage.foldername(name))[1]
    -- 또는 연결된 학생의 파일 (강사용)
    OR public.is_connected_student(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

-- ----------------------------------------------------------------------------
-- 2.3 학생: 본인 파일만 삭제
-- ----------------------------------------------------------------------------
CREATE POLICY "recordings_delete_own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'practice-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- 3. STORAGE POLICIES - question-audio
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 모든 인증된 사용자: 조회 가능
-- ----------------------------------------------------------------------------
CREATE POLICY "question_audio_select_all"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'question-audio'
  AND auth.uid() IS NOT NULL
);

-- ----------------------------------------------------------------------------
-- NOTE: INSERT/DELETE는 Service Role만 가능
-- TTS 오디오 파일 생성은 Edge Function에서 처리
-- ----------------------------------------------------------------------------
