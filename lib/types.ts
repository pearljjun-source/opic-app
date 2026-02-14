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

/** 사용자 역할 (legacy — 점진적 폐기, organization_members.role 사용) */
export type UserRole = Database['public']['Enums']['user_role'];

/** 조직 내 역할 */
export type OrgRole = 'owner' | 'teacher' | 'student';

/** 플랫폼 역할 (SaaS 관리자) */
export type PlatformRole = 'super_admin';

/** 초대 상태 */
export type InviteStatus = Database['public']['Enums']['invite_status'];

/** 스크립트 상태 */
export type ScriptStatus = Database['public']['Enums']['script_status'];

/** 질문 유형 */
export type QuestionType = Database['public']['Enums']['question_type'];

/** API 유형 (사용량 추적용) */
export type ApiType = Database['public']['Enums']['api_type'];

/** 알림 유형 */
export type NotificationType = 'practice_completed' | 'teacher_feedback' | 'new_script' | 'student_connected' | 'owner_invite_redeemed' | 'teacher_connected';

/** 난이도 레벨 */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** OPIc 등급 */
export type OpicGrade = 'NL' | 'NM' | 'NH' | 'IL' | 'IM1' | 'IM2' | 'IM3' | 'IH' | 'AL';

/** 토픽 카테고리 */
export type TopicCategory = 'survey' | 'unexpected';

// ============================================================================
// Utility Types (React Native 환경 호환)
// ============================================================================

/** setTimeout/setInterval 반환 타입 (모든 JS 환경 호환) */
export type TimerId = ReturnType<typeof setTimeout>;

// ============================================================================
// Application Types
// ============================================================================

/** AI 피드백 구조 (v2: ACTFL 기반 확장, v1 필드 호환 유지) */
export interface AIFeedback {
  // === v1 필드 (기존 호환) ===
  summary: string;
  reproduction_rate: number;
  missed_phrases: string[];
  extra_phrases: string[];
  pronunciation_tips: string[];
  grammar_issues: string[];
  suggestions: string[];

  // === v2 필드 (optional, 새 피드백에만 존재) ===

  /** Claude가 산출한 종합 점수 (0-100) */
  overall_score?: number;

  /** 추가 표현 평가 (긍정/중립/부정) */
  creative_additions?: Array<{
    phrase: string;
    evaluation: 'positive' | 'neutral' | 'negative';
    comment: string;
  }>;

  /** 에러 분석 (교정 포함) */
  error_analysis?: Array<{
    type: 'grammar' | 'pronunciation' | 'vocabulary' | 'l1_transfer';
    original: string;
    corrected: string;
    explanation: string;
  }>;

  /** 강점 리스트 (한국어) */
  strengths?: string[];

  /** 우선 개선 사항 (최대 3개) */
  priority_improvements?: Array<{
    area: string;
    tip: string;
  }>;

  /** 격려 메시지 (한국어) */
  encouragement?: string;
}

/** 학생 연습 통계 (get_student_practice_stats RPC 반환 타입) */
export interface StudentPracticeStats {
  total_practices: number;
  total_duration_minutes: number;
  avg_score: number;
  avg_reproduction_rate: number;
  this_week_practices: number;
  last_practice_at: string | null;
  /** 지난주 평균 점수 (7~14일 전) — null이면 데이터 없음 */
  prev_avg_score: number | null;
  /** 지난주 평균 재현율 (7~14일 전) — null이면 데이터 없음 */
  prev_avg_reproduction_rate: number | null;
  /** 목표 OPIc 등급 (강사가 설정) */
  target_opic_grade: OpicGrade | null;
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
// Organization Types (조직 기반 멀티테넌트)
// ============================================================================

/** 조직/학원 */
export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** 조직 멤버십 */
export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** 내가 속한 조직 (get_my_organizations RPC 반환) */
export interface MyOrganization {
  id: string;
  name: string;
  role: OrgRole;
  member_count: number;
}

/** 조직 내 강사/원장 아이템 (get_org_teachers RPC 반환) */
export interface OrgTeacherItem {
  id: string;
  name: string;
  email: string;
  role: OrgRole;
  created_at: string;
  students_count: number;
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

/** 학생 상세 통계 (get_student_detail RPC의 stats 필드) */
export interface StudentDetailStats {
  scripts_count: number;
  practices_count: number;
  total_duration_minutes: number;
  avg_score: number | null;
  avg_reproduction_rate: number | null;
  last_practice_at: string | null;
  this_week_practices: number;
  connected_at: string;
  /** 강사 메모 */
  notes: string | null;
  /** 목표 OPIc 등급 */
  target_opic_grade: OpicGrade | null;
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
  topic_category: string;
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

// ============================================================================
// Dashboard Types (대시보드 개선)
// ============================================================================

/** 강사 대시보드 요약 통계 */
export interface TeacherDashboardStats {
  /** 총 학생 수 */
  totalStudents: number;
  /** 이번 주 전체 연습 수 */
  thisWeekPractices: number;
  /** 피드백 대기 건수 */
  pendingFeedbacks: number;
  /** 전체 평균 점수 (학생이 없으면 null) */
  avgScore: number | null;
}

/** 관심 필요 유형 */
export type AttentionType = 'inactive' | 'no_practice';

/** 관심 필요 수준 */
export type AttentionLevel = 'warning' | 'danger';

/** 관심 필요 학생 아이템 */
export interface AttentionItem {
  student: TeacherStudentListItem;
  type: AttentionType;
  level: AttentionLevel;
  message: string;
}

/** OPIc 등급 추정 결과 */
export interface OpicLevelEstimate {
  grade: OpicGrade;
  label: string;
}

/** 트렌드 방향 */
export type TrendDirection = 'up' | 'down' | 'same' | null;

// ============================================================================
// Admin Dashboard Types
// ============================================================================

/** 랜딩 페이지 섹션 */
export interface LandingSection {
  id: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  content: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 랜딩 페이지 아이템 */
export interface LandingItem {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  video_url: string | null;
  metadata: Record<string, unknown> | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** 관리자 대시보드 KPI 통계 */
export interface AdminDashboardStats {
  total_users: number;
  total_teachers: number;
  total_students: number;
  active_7d: number;
  active_30d: number;
  total_subscribers: number;
  mrr: number;
}

/** 관리자 사용자 목록 아이템 */
export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  last_sign_in: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
}

/** 관리자 감사 로그 */
export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  content_hash: string;
  previous_hash: string | null;
  created_at: string;
}

/** 학원 원장 초대 아이템 (admin_list_owner_invites RPC) */
export interface AdminOwnerInviteItem {
  id: string;
  code: string;
  status: 'pending' | 'used' | 'expired';
  organization_name: string;
  expires_at: string;
  created_at: string;
  used_by: string | null;
  used_at: string | null;
  used_by_name: string | null;
  used_by_email: string | null;
  organization_id: string | null;
}

/** 학원 목록 아이템 (admin_list_organizations RPC) */
export interface AdminOrganizationItem {
  id: string;
  name: string;
  created_at: string;
  owner_name: string;
  owner_email: string;
  member_count: number;
  teacher_count: number;
  student_count: number;
}

// ============================================================================
// Subscription & Payment Types
// ============================================================================

/** 구독 플랜 */
export interface SubscriptionPlan {
  id: string;
  plan_key: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_students: number;
  max_scripts: number;
  ai_feedback_enabled: boolean;
  tts_enabled: boolean;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 구독 */
export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  billing_provider: 'toss' | 'stripe';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 결제 기록 */
export interface PaymentRecord {
  id: string;
  subscription_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
  provider_payment_id: string | null;
  payment_method: string | null;
  card_last4: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

/** 구독 통계 (관리자) */
export interface SubscriptionStats {
  total_subscribers: number;
  mrr: number;
  arr: number;
  churn_rate: number;
  plan_distribution: Array<{
    plan_key: string;
    plan_name: string;
    count: number;
  }>;
}
