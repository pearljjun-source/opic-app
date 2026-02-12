// ============================================================================
// OPIc 학습 앱 - TypeScript 타입 정의 (Single Source of Truth)
// ============================================================================
// Database 타입은 Supabase CLI로 자동 생성됩니다.
// 애플리케이션 타입은 이 파일에서 정의합니다.
// ============================================================================

// ============================================================================
// Re-export Database Types from Supabase CLI generated file
// ============================================================================

export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from './database.types';
import type { Database } from './database.types';

// ============================================================================
// Core Types (상수에서 사용되는 기본 타입)
// ============================================================================

/** 사용자 역할 */
export type UserRole = Database['public']['Enums']['user_role'];

/** 초대 상태 */
export type InviteStatus = Database['public']['Enums']['invite_status'];

/** 스크립트 상태 */
export type ScriptStatus = Database['public']['Enums']['script_status'];

/** 질문 유형 */
export type QuestionType = Database['public']['Enums']['question_type'];

/** API 유형 (사용량 추적용) */
export type ApiType = Database['public']['Enums']['api_type'];

/** 알림 유형 */
export type NotificationType = 'practice_completed' | 'teacher_feedback' | 'new_script' | 'student_connected';

/** 난이도 레벨 */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** OPIc 등급 */
export type OpicGrade = 'NL' | 'NM' | 'NH' | 'IL' | 'IM1' | 'IM2' | 'IM3' | 'IH' | 'AL';

// ============================================================================
// Utility Types (React Native 환경 호환)
// ============================================================================

/** setTimeout/setInterval 반환 타입 (모든 JS 환경 호환) */
export type TimerId = ReturnType<typeof setTimeout>;

// ============================================================================
// Application Types
// ============================================================================

/** AI 피드백 구조 */
export interface AIFeedback {
  summary: string;
  reproduction_rate: number;
  missed_phrases: string[];
  extra_phrases: string[];
  pronunciation_tips: string[];
  grammar_issues: string[];
  suggestions: string[];
}

/** 학생 연습 통계 */
export interface StudentPracticeStats {
  total_practices: number;
  total_duration_minutes: number;
  avg_score: number;
  avg_reproduction_rate: number;
  this_week_practices: number;
  last_practice_at: string | null;
}

/** API Rate Limit 결과 */
export interface ApiRateLimitResult {
  allowed: boolean;
  current_count: number;
  limit: number;
  remaining: number;
  reset_at: string;
}

// ============================================================================
// Derived Types (테이블 Row 타입 별칭)
// ============================================================================

export type User = Database['public']['Tables']['users']['Row'];
export type Invite = Database['public']['Tables']['invites']['Row'];
export type TeacherStudent = Database['public']['Tables']['teacher_student']['Row'];
export type Topic = Database['public']['Tables']['topics']['Row'];
export type Question = Database['public']['Tables']['questions']['Row'];
export type StudentTopic = Database['public']['Tables']['student_topics']['Row'];
export type Script = Database['public']['Tables']['scripts']['Row'];
export type ScriptView = Database['public']['Tables']['script_views']['Row'];
export type Practice = Database['public']['Tables']['practices']['Row'];
export type TeacherFeedback = Database['public']['Tables']['teacher_feedbacks']['Row'];
export type UserConsent = Database['public']['Tables']['user_consents']['Row'];
export type AppConfig = Database['public']['Tables']['app_config']['Row'];
export type ApiUsage = Database['public']['Tables']['api_usage']['Row'];
export type NotificationLog = Database['public']['Tables']['notification_logs']['Row'];

// ============================================================================
// RPC Function Return Types
// ============================================================================

/** 강사의 학생 목록 아이템 (get_teacher_students RPC 반환 타입) */
export type TeacherStudentListItem = Database['public']['Functions']['get_teacher_students']['Returns'][number];

/** 학생 스크립트 목록 아이템 (get_student_scripts RPC 반환 타입) */
export type StudentScriptListItem = Database['public']['Functions']['get_student_scripts']['Returns'][number];

/** 학생 연습 기록 목록 아이템 (get_student_practices RPC 반환 타입) */
export type StudentPracticeListItem = Database['public']['Functions']['get_student_practices']['Returns'][number];

// ============================================================================
// Extended Types (관계 포함)
// ============================================================================

/** 스크립트 + 질문 정보 */
export interface ScriptWithQuestion extends Script {
  question: Question;
}

/** 스크립트 + 질문 + 토픽 정보 */
export interface ScriptWithDetails extends Script {
  question: Question & {
    topic: Topic;
  };
}

/** 연습 + 스크립트 정보 */
export interface PracticeWithScript extends Practice {
  script: ScriptWithQuestion;
}

/** 연습 + 강사 피드백 */
export interface PracticeWithFeedback extends Practice {
  teacher_feedback?: TeacherFeedback;
}

/** 학생 정보 + 통계 */
export interface StudentWithStats extends User {
  stats?: StudentPracticeStats;
  scripts_count?: number;
  practices_count?: number;
}

/** 질문 + 토픽 정보 */
export interface QuestionWithTopic extends Question {
  topic: Topic;
}

// ============================================================================
// Student Detail Types (학생 상세 화면용)
// ============================================================================

/** 학생 상세 통계 */
export interface StudentDetailStats {
  scripts_count: number;
  practices_count: number;
  total_duration_minutes: number;
  avg_score: number | null;
  avg_reproduction_rate: number | null;
  last_practice_at: string | null;
  this_week_practices: number;
  connected_at: string;
}

/** 학생 상세 정보 (get_student_detail RPC 반환 타입) */
export interface StudentDetailInfo {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

/** 학생 상세 조회 결과 */
export interface StudentDetailResult {
  success: boolean;
  student?: StudentDetailInfo;
  stats?: StudentDetailStats;
  error?: string;
}

// ============================================================================
// Class Types (반 관리)
// ============================================================================

/** 강사의 반 목록 아이템 (get_teacher_classes RPC 반환 타입) */
export interface TeacherClassListItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
}

/** 반 상세 정보 내 멤버 아이템 */
export interface ClassMemberItem {
  id: string;
  name: string;
  email: string;
  scripts_count: number;
  practices_count: number;
  last_practice_at: string | null;
  avg_score: number | null;
  avg_reproduction_rate: number | null;
}

/** 반 상세 조회 결과 (get_class_detail RPC 반환 타입) */
export interface ClassDetailResult {
  success: boolean;
  class?: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  };
  members?: ClassMemberItem[];
  error?: string;
}

// ============================================================================
// Topic Navigation Types (주제 기반 네비게이션)
// ============================================================================

/** 학생의 배정 토픽 + 진행 통계 (get_student_topics_with_progress RPC 반환 타입) */
export interface StudentTopicWithProgress {
  topic_id: string;
  topic_name_ko: string;
  topic_name_en: string;
  topic_icon: string | null;
  topic_sort_order: number;
  total_questions: number;
  scripts_count: number;
  practices_count: number;
  best_avg_score: number | null;
  last_practice_at: string | null;
}

/** 토픽별 질문 + 스크립트/연습 현황 (get_topic_questions_with_scripts RPC 반환 타입) */
export interface TopicQuestionWithScript {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  difficulty: number;
  hint_ko: string | null;
  audio_url: string | null;
  sort_order: number;
  script_id: string | null;
  script_content: string | null;
  script_status: ScriptStatus | null;
  script_created_at: string | null;
  practices_count: number;
  last_practice_at: string | null;
  best_score: number | null;
  best_reproduction_rate: number | null;
}
