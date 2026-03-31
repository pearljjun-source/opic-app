// ============================================================================
// OPIc 학습 앱 - 상수 정의
// ============================================================================
// 이 파일은 값(value)만 정의합니다.
// 타입은 types.ts에서 정의하고 여기서 import합니다.
// ============================================================================

import type { InviteStatus, ScriptStatus, QuestionType, ApiType, NotificationType, TopicCategory, OrgRole, PlatformRole, ExamType, CancellationReason } from './types';

// ============================================================================
// 상태/역할 상수
// ============================================================================

/** 조직 역할 상수 */
export const ORG_ROLES: Record<string, OrgRole> = {
  OWNER: 'owner',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

/** 조직 역할 한글 라벨 */
export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: '원장',
  teacher: '강사',
  student: '학생',
} as const;

/** 플랫폼 역할 상수 */
export const PLATFORM_ROLES: Record<string, PlatformRole> = {
  SUPER_ADMIN: 'super_admin',
} as const;

/** 초대 상태 상수 */
export const INVITE_STATUS: Record<string, InviteStatus> = {
  PENDING: 'pending',
  USED: 'used',
  EXPIRED: 'expired',
} as const;

/** 스크립트 상태 상수 */
export const SCRIPT_STATUS: Record<string, ScriptStatus> = {
  DRAFT: 'draft',
  COMPLETE: 'complete',
} as const;

/** 질문 유형 상수 */
export const QUESTION_TYPES: Record<string, QuestionType> = {
  DESCRIBE: 'describe',
  ROUTINE: 'routine',
  EXPERIENCE: 'experience',
  COMPARISON: 'comparison',
  ROLEPLAY: 'roleplay',
  ADVANCED: 'advanced',
} as const;

/** 질문 유형 한글 라벨 */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  describe: '묘사/설명',
  routine: '루틴',
  experience: '과거 경험',
  comparison: '비교',
  roleplay: '롤플레이',
  advanced: '어드밴스',
} as const;

/** 토픽 카테고리 상수 */
export const TOPIC_CATEGORIES: Record<string, TopicCategory> = {
  SURVEY: 'survey',
  UNEXPECTED: 'unexpected',
} as const;

/** 토픽 카테고리 한글 라벨 */
export const TOPIC_CATEGORY_LABELS: Record<TopicCategory, string> = {
  survey: '서베이 주제',
  unexpected: '돌발 주제',
} as const;

/** API 유형 상수 */
export const API_TYPES: Record<string, ApiType> = {
  WHISPER: 'whisper',
  CLAUDE: 'claude',
  TTS: 'tts',
} as const;

/** 알림 유형 상수 */
export const NOTIFICATION_TYPES: Record<string, NotificationType> = {
  PRACTICE_COMPLETED: 'practice_completed',
  TEACHER_FEEDBACK: 'teacher_feedback',
  NEW_SCRIPT: 'new_script',
  STUDENT_CONNECTED: 'student_connected',
  PAYMENT_FAILED: 'payment_failed',
} as const;

/** 취소 사유 목록 */
export const CANCELLATION_REASONS: { key: CancellationReason; label: string; offer: string }[] = [
  { key: 'too_expensive', label: '비용이 부담됩니다', offer: 'downgrade' },
  { key: 'not_using', label: '충분히 활용하지 못하고 있습니다', offer: 'none' },
  { key: 'missing_feature', label: '필요한 기능이 없습니다', offer: 'feedback' },
  { key: 'switching', label: '다른 서비스로 전환합니다', offer: 'downgrade' },
  { key: 'closing_academy', label: '학원을 정리합니다', offer: 'none' },
  { key: 'other', label: '기타', offer: 'none' },
] as const;

// ============================================================================
// 난이도/등급
// ============================================================================

/** 난이도 레벨 */
export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** OPIc 등급 */
export const OPIC_GRADES = [
  'NL', 'NM', 'NH',
  'IL', 'IM1', 'IM2', 'IM3', 'IH',
  'AL',
] as const;

/** 난이도 → OPIc 등급 라벨 매핑 (콤보 롤플레이 등 표시용) */
export const DIFFICULTY_GRADE_LABELS: Record<number, string> = {
  2: 'IM1',
  3: 'IM2',
  4: 'IM3',
  5: 'IH',
  6: 'AL',
} as const;

// ============================================================================
// 구독 플랜
// ============================================================================

/** 구독 플랜 키 (DB subscription_plans.plan_key와 동기화 필수) */
export const PLAN_KEYS = {
  FREE: 'free',
  SOLO: 'solo',
  PRO: 'pro',
  ACADEMY: 'academy',
} as const;

/** 유료 플랜 키 목록 (결제 가능) */
export const PAID_PLAN_KEYS = ['solo', 'pro', 'academy'] as const;

/** 전체 플랜 키 목록 (정렬 순서) */
export const ALL_PLAN_KEYS = ['free', 'solo', 'pro', 'academy'] as const;

// ============================================================================
// 처리 단계 라벨 (연습/시험 공통)
// ============================================================================

/** 스크립트 연습 처리 단계 */
export type PracticeProcessingStep = 'upload' | 'save' | 'stt' | 'feedback' | 'done';

export const PRACTICE_STEP_LABELS: Record<PracticeProcessingStep, string> = {
  upload: '녹음 파일 업로드 중...',
  save: '연습 기록 저장 중...',
  stt: '음성을 텍스트로 변환 중...',
  feedback: 'AI가 답변을 분석 중...',
  done: '완료!',
} as const;

/** 시험 결과 처리 단계 */
export type ExamProcessingStage = 'upload' | 'stt' | 'evaluate';

export const EXAM_STAGE_LABELS: Record<ExamProcessingStage, string> = {
  upload: '녹음 업로드 중',
  stt: '음성 인식 중',
  evaluate: 'AI 종합 평가 중',
} as const;

// ============================================================================
// 전략 그룹 (서베이 전략 가이드용 — DB strategy_group 컬럼과 동기화)
// ============================================================================

export const STRATEGY_GROUP_INFO: Record<string, { label: string; icon: string; description: string }> = {
  personal: { label: '자기소개', icon: 'person-outline', description: '필수 토픽 (항상 출제)' },
  living: { label: '생활/주거', icon: 'home-outline', description: '집, 동네 관련 — 묘사 표현 공유' },
  entertainment: { label: '엔터테인먼트', icon: 'film-outline', description: '음악, 영화, TV, 공연 — 취미 표현 공유' },
  daily_life: { label: '일상생활', icon: 'cart-outline', description: '쇼핑, 음식 — 일상 루틴 표현 공유' },
  outdoor_activity: { label: '야외 활동', icon: 'sunny-outline', description: '운동, 여행, 공원, 해변 — 활동 표현 공유' },
  technology: { label: '기술/통신', icon: 'phone-portrait-outline', description: '전화, 인터넷 — 기기/온라인 표현 공유' },
  indoor_hobby: { label: '실내 취미', icon: 'book-outline', description: '독서 등 — 어휘 수준 약간 높음' },
} as const;

// ============================================================================
// 대시보드 설정
// ============================================================================

/** 학생 학습 목표 기본값 */
export const STUDENT_GOALS = {
  /** 주간 연습 횟수 목표 */
  WEEKLY_PRACTICES: 5,
} as const;

/** 점수 → OPIc 등급 매핑 기준 (하한선) */
export const OPIC_SCORE_THRESHOLDS = [
  { minScore: 95, grade: 'AL' as const },
  { minScore: 88, grade: 'IH' as const },
  { minScore: 80, grade: 'IM3' as const },
  { minScore: 72, grade: 'IM2' as const },
  { minScore: 64, grade: 'IM1' as const },
  { minScore: 55, grade: 'IL' as const },
  { minScore: 45, grade: 'NH' as const },
  { minScore: 35, grade: 'NM' as const },
  { minScore: 0, grade: 'NL' as const },
] as const;

/** 관심 필요 학생 기준 */
export const ATTENTION_THRESHOLDS = {
  /** 위험: 미연습 일수 (빨간색) */
  DANGER_INACTIVE_DAYS: 14,
  /** 경고: 미연습 일수 (노란색) */
  WARNING_INACTIVE_DAYS: 7,
} as const;

// ============================================================================
// 색상 테마
// ============================================================================

export const COLORS = {
  // Primary — 딥 로즈 (테마색)
  PRIMARY: '#D4707F',
  PRIMARY_LIGHT: '#FDE8EB',
  PRIMARY_DARK: '#B85A69',

  // Secondary
  SECONDARY: '#F5A623',
  SECONDARY_LIGHT: '#FEF3C7',

  // Status
  SUCCESS: '#34D399',
  WARNING: '#FBBF24',
  ERROR: '#F87171',
  INFO: '#E88B9A',

  // Grayscale
  WHITE: '#FFFFFF',
  GRAY_50: '#FAFAFA',
  GRAY_100: '#F5F5F5',
  GRAY_200: '#E5E5E5',
  GRAY_300: '#D4D4D4',
  GRAY_400: '#A3A3A3',
  GRAY_500: '#737373',
  GRAY_600: '#525252',
  GRAY_700: '#404040',
  GRAY_800: '#262626',
  GRAY_900: '#171717',
  BLACK: '#000000',

  // Semantic
  TEXT_PRIMARY: '#171717',
  TEXT_SECONDARY: '#737373',
  TEXT_DISABLED: '#A3A3A3',
  BACKGROUND: '#FFFFFF',
  BACKGROUND_SECONDARY: '#FAFAFA',
  BORDER: '#E5E5E5',
} as const;

// ============================================================================
// 결제 콜백
// ============================================================================

/** 결제 콜백 액션/상태 상수 */
export const PAYMENT_CALLBACK = {
  /** 콜백 전용 라우트 경로 */
  PATH: '/(teacher)/manage/payment-callback',
  /** 콜백 액션 */
  ACTIONS: {
    NEW_SUBSCRIPTION: 'new-subscription',
    UPDATE_BILLING: 'update-billing',
  },
  /** 콜백 상태 */
  STATUS: {
    SUCCESS: 'success',
    FAIL: 'fail',
    PROCESSING: 'processing',
  },
} as const;

// ============================================================================
// 앱 설정
// ============================================================================

export const APP_CONFIG = {
  // 초대 코드
  INVITE_CODE_LENGTH: 6,
  INVITE_EXPIRE_DAYS: 7,
  INVITE_MAX_USES_OPTIONS: [1, 10, 30, 50, 0] as const, // 0 = 무제한

  // 녹음
  MAX_RECORDING_DURATION_SEC: 120, // 2분
  AUDIO_SAMPLE_RATE: 44100,
  AUDIO_BIT_RATE: 128000,

  // API Rate Limiting (표시용 — 실제 적용은 supabase/functions/_shared/constants.ts의 RATE_LIMITS)
  API_RATE_LIMIT: {
    WHISPER: { maxRequests: 30, windowMinutes: 60 },
    CLAUDE: { maxRequests: 30, windowMinutes: 60 },
    TTS: { maxRequests: 50, windowMinutes: 60 },
  },

  // 점수
  MIN_SCORE: 0,
  MAX_SCORE: 100,

  // 페이지네이션
  DEFAULT_PAGE_SIZE: 20,
} as const;

// ============================================================================
// Storage 버킷
// ============================================================================

export const STORAGE_BUCKETS = {
  PRACTICE_RECORDINGS: 'practice-recordings',
  QUESTION_AUDIO: 'question-audio',
  LANDING_ASSETS: 'landing-assets',
} as const;

// ============================================================================
// 시험 설정 (모의고사 / 콤보 롤플레이 / 레벨 테스트)
// ============================================================================

/** 시험 유형 상수 */
export const EXAM_TYPES: Record<string, ExamType> = {
  MOCK_EXAM: 'mock_exam',
  COMBO_ROLEPLAY: 'combo_roleplay',
  LEVEL_TEST: 'level_test',
} as const;

/** 시험 유형 한글 라벨 */
export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  mock_exam: '실전 모의고사',
  combo_roleplay: '콤보 롤플레이',
  level_test: '레벨 테스트',
} as const;

/** 자기평가 레벨 (모의고사 시작 시 선택)
 * ⚠️ questionCount 값은 DB RPC generate_mock_exam_questions에도 하드코딩됨
 *    (045_exam_rpc_include_audio_url.sql: CASE WHEN p_self_assessment <= 2 THEN 12 ELSE 15 END)
 *    변경 시 마이그레이션도 함께 수정 필요
 */
export const SELF_ASSESSMENT_LEVELS = [
  { level: 1, label: '레벨 1', description: '10단어 이하로 말할 수 있습니다', questionCount: 12 },
  { level: 2, label: '레벨 2', description: '간단한 문장을 만들 수 있습니다', questionCount: 12 },
  { level: 3, label: '레벨 3', description: '일상 주제에 대해 문장으로 말합니다', questionCount: 15 },
  { level: 4, label: '레벨 4', description: '익숙한 상황에서 대화할 수 있습니다', questionCount: 15 },
  { level: 5, label: '레벨 5', description: '다양한 주제에 대해 자신있게 말합니다', questionCount: 15 },
  { level: 6, label: '레벨 6', description: '의견을 논리적으로 표현할 수 있습니다', questionCount: 15 },
] as const;

/** ACTFL 4차원 평가 항목 */
export const ACTFL_DIMENSIONS = {
  FUNCTION: { key: 'score_function', label_ko: '과제 수행', label_en: 'Function/Task' },
  ACCURACY: { key: 'score_accuracy', label_ko: '정확성', label_en: 'Accuracy' },
  CONTENT: { key: 'score_content', label_ko: '내용/맥락', label_en: 'Content/Context' },
  TEXT_TYPE: { key: 'score_text_type', label_ko: '텍스트 유형', label_en: 'Text Type' },
} as const;

/** 문항 유형별 답변 시간 제한 (초) — 실제 OPIc 기준 */
export const QUESTION_TIME_LIMITS: Record<string, number> = {
  describe: 60,
  routine: 60,
  experience: 90,
  comparison: 90,
  roleplay: 60,
  advanced: 90,
  // 롤플레이 시나리오 문항
  ask_questions: 60,
  problem_solution: 90,
  related_experience: 90,
  default: 60,
} as const;

/** OPIc 서베이 토픽 선택 설정 */
export const SURVEY_CONFIG = {
  /** 총 최소 선택 수 (서베이 토픽 합산) */
  TOTAL_MIN_SELECTIONS: 12,
} as const;

/** 시험 설정 */
export const EXAM_CONFIG = {
  /** 모의고사 제한 시간 (40분) */
  MOCK_EXAM_DURATION_SEC: 40 * 60,
  /** 레벨 테스트 문항 수 */
  LEVEL_TEST_QUESTION_COUNT: 6,
  /** 콤보 롤플레이 문항 수 */
  COMBO_QUESTION_COUNT: 3,
  /** @deprecated SURVEY_CONFIG.TOTAL_MIN_SELECTIONS 사용 */
  MIN_SURVEY_TOPICS: 12,
  /** 시간당 최대 시험 횟수 */
  MAX_EXAMS_PER_HOUR: 2,
  /** 문항별 타이머 경고 표시 임계값 (초) */
  QUESTION_WARNING_THRESHOLD_SEC: 10,
  /** 문항 간 자동 전환 대기 시간 (밀리초) */
  QUESTION_TRANSITION_DELAY_MS: 1500,
} as const;

// ============================================================================
// 연락처
// ============================================================================

export const CONTACT = {
  /** 고객 지원 이메일 — 이용약관, 개인정보처리방침, 플랜 문의 등 */
  SUPPORT_EMAIL: 'speaky@support.com',
} as const;
