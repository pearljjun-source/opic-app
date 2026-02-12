-- ============================================================================
-- OPIc 학습 앱 - 테이블 스키마
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. CUSTOM TYPES (ENUMS)
-- ============================================================================

-- 사용자 역할
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');

-- 초대 코드 상태
CREATE TYPE invite_status AS ENUM ('pending', 'used', 'expired');

-- 스크립트 상태
CREATE TYPE script_status AS ENUM ('draft', 'complete');

-- 질문 유형
CREATE TYPE question_type AS ENUM ('describe', 'routine', 'experience', 'comparison', 'roleplay', 'advanced');

-- API 유형 (사용량 추적용)
CREATE TYPE api_type AS ENUM ('whisper', 'claude', 'tts');

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 users (사용자)
-- ----------------------------------------------------------------------------
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  push_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.users IS '사용자 정보 (강사/학생)';
COMMENT ON COLUMN public.users.push_token IS 'Expo Push Notification 토큰';

-- ----------------------------------------------------------------------------
-- 3.2 invites (초대 코드)
-- ----------------------------------------------------------------------------
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  status invite_status DEFAULT 'pending',
  used_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.invites IS '강사가 생성한 초대 코드';
COMMENT ON COLUMN public.invites.code IS '6자리 초대 코드';
COMMENT ON COLUMN public.invites.expires_at IS '코드 만료 시간 (기본 7일)';

CREATE INDEX idx_invites_code ON public.invites(code) WHERE status = 'pending';
CREATE INDEX idx_invites_teacher_id ON public.invites(teacher_id);

-- ----------------------------------------------------------------------------
-- 3.3 teacher_student (강사-학생 연결)
-- ----------------------------------------------------------------------------
CREATE TABLE public.teacher_student (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  UNIQUE(teacher_id, student_id)
);

COMMENT ON TABLE public.teacher_student IS '강사-학생 연결 관계';

CREATE INDEX idx_teacher_student_teacher ON public.teacher_student(teacher_id);
CREATE INDEX idx_teacher_student_student ON public.teacher_student(student_id);

-- ----------------------------------------------------------------------------
-- 3.4 topics (토픽 - 문제은행)
-- ----------------------------------------------------------------------------
CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ko text NOT NULL,
  name_en text NOT NULL,
  icon text,
  description text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.topics IS 'OPIc 토픽 목록 (Background Survey 12개 토픽)';
COMMENT ON COLUMN public.topics.icon IS '이모지 또는 아이콘 이름';
COMMENT ON COLUMN public.topics.description IS '토픽 설명 (예: 거주지 묘사하기)';

CREATE INDEX idx_topics_order ON public.topics(sort_order) WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 3.5 questions (질문 - 문제은행)
-- ----------------------------------------------------------------------------
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type question_type NOT NULL,
  difficulty int NOT NULL CHECK (difficulty BETWEEN 1 AND 6),
  audio_url text,
  hint_ko text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.questions IS 'OPIc 질문 목록';
COMMENT ON COLUMN public.questions.audio_url IS 'TTS 캐싱된 오디오 파일 URL (Supabase Storage)';
COMMENT ON COLUMN public.questions.difficulty IS '난이도 1-6 (Self-Assessment 레벨)';
COMMENT ON COLUMN public.questions.hint_ko IS '한국어 힌트/해석';

CREATE INDEX idx_questions_topic ON public.questions(topic_id, sort_order) WHERE is_active = true;
CREATE INDEX idx_questions_type ON public.questions(question_type);

-- ----------------------------------------------------------------------------
-- 3.6 student_topics (학생 토픽 선택)
-- ----------------------------------------------------------------------------
CREATE TABLE public.student_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  UNIQUE(student_id, topic_id)
);

COMMENT ON TABLE public.student_topics IS '학생이 선택한 토픽 (Background Survey)';

CREATE INDEX idx_student_topics_student ON public.student_topics(student_id);

-- ----------------------------------------------------------------------------
-- 3.7 scripts (스크립트)
-- ----------------------------------------------------------------------------
CREATE TABLE public.scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  content text NOT NULL,
  comment text,
  status script_status DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.scripts IS '강사가 학생을 위해 작성한 스크립트';
COMMENT ON COLUMN public.scripts.content IS '영어 스크립트 내용';
COMMENT ON COLUMN public.scripts.comment IS '강사의 코멘트/팁';

CREATE INDEX idx_scripts_student ON public.scripts(student_id, created_at DESC);
CREATE INDEX idx_scripts_teacher ON public.scripts(teacher_id, created_at DESC);
CREATE INDEX idx_scripts_question ON public.scripts(question_id);

-- ----------------------------------------------------------------------------
-- 3.8 script_views (스크립트 조회 기록)
-- ----------------------------------------------------------------------------
CREATE TABLE public.script_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),

  UNIQUE(script_id)
);

COMMENT ON TABLE public.script_views IS '학생이 스크립트를 확인한 기록 (스크립트당 1개)';

-- ----------------------------------------------------------------------------
-- 3.9 practices (연습 기록)
-- ----------------------------------------------------------------------------
CREATE TABLE public.practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  transcription text,
  score int CHECK (score BETWEEN 0 AND 100),
  reproduction_rate int CHECK (reproduction_rate BETWEEN 0 AND 100),
  feedback jsonb,
  duration int,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.practices IS '학생의 연습 기록';
COMMENT ON COLUMN public.practices.audio_url IS '녹음 파일 URL (Supabase Storage)';
COMMENT ON COLUMN public.practices.transcription IS 'Whisper STT 변환 결과';
COMMENT ON COLUMN public.practices.score IS '종합 점수 (0-100)';
COMMENT ON COLUMN public.practices.reproduction_rate IS '스크립트 재현율 (0-100%)';
COMMENT ON COLUMN public.practices.feedback IS 'AI 피드백 JSON';
COMMENT ON COLUMN public.practices.duration IS '녹음 시간 (초)';

CREATE INDEX idx_practices_student ON public.practices(student_id, created_at DESC);
CREATE INDEX idx_practices_script ON public.practices(script_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3.10 teacher_feedbacks (강사 피드백)
-- ----------------------------------------------------------------------------
CREATE TABLE public.teacher_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feedback text NOT NULL,
  created_at timestamptz DEFAULT now(),

  UNIQUE(practice_id)
);

COMMENT ON TABLE public.teacher_feedbacks IS '연습에 대한 강사의 추가 피드백 (연습당 1개)';

CREATE INDEX idx_teacher_feedbacks_teacher ON public.teacher_feedbacks(teacher_id);

-- ----------------------------------------------------------------------------
-- 3.11 user_consents (사용자 동의 기록)
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  terms_agreed boolean DEFAULT false,
  terms_agreed_at timestamptz,
  privacy_agreed boolean DEFAULT false,
  privacy_agreed_at timestamptz,
  voice_data_agreed boolean DEFAULT false,
  voice_data_agreed_at timestamptz,
  marketing_agreed boolean DEFAULT false,
  marketing_agreed_at timestamptz,
  created_at timestamptz DEFAULT now(),

  UNIQUE(user_id)
);

COMMENT ON TABLE public.user_consents IS '사용자 동의 기록 (이용약관, 개인정보처리방침 등)';

-- ----------------------------------------------------------------------------
-- 3.12 app_config (앱 설정)
-- ----------------------------------------------------------------------------
CREATE TABLE public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.app_config IS '앱 설정 (버전 관리, 점검 모드 등)';

-- ----------------------------------------------------------------------------
-- 3.13 api_usage (API 사용량 추적)
-- ----------------------------------------------------------------------------
CREATE TABLE public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  api_type api_type NOT NULL,
  tokens_used int,
  duration_ms int,
  called_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.api_usage IS 'API 사용량 추적 (Rate Limiting)';

CREATE INDEX idx_api_usage_user_time ON public.api_usage(user_id, called_at DESC);
CREATE INDEX idx_api_usage_type_time ON public.api_usage(api_type, called_at DESC);

-- ----------------------------------------------------------------------------
-- 3.14 notification_logs (알림 로그)
-- ----------------------------------------------------------------------------
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  sent_at timestamptz DEFAULT now(),
  read_at timestamptz
);

COMMENT ON TABLE public.notification_logs IS '푸시 알림 발송 로그';

CREATE INDEX idx_notification_logs_user ON public.notification_logs(user_id, sent_at DESC);
CREATE INDEX idx_notification_logs_unread ON public.notification_logs(user_id) WHERE read_at IS NULL;
