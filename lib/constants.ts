// ============================================================================
// OPIc 학습 앱 - 상수 정의
// ============================================================================
// 이 파일은 값(value)만 정의합니다.
// 타입은 types.ts에서 정의하고 여기서 import합니다.
// ============================================================================

import type { UserRole, InviteStatus, ScriptStatus, QuestionType, ApiType, NotificationType } from './types';

// ============================================================================
// 상태/역할 상수
// ============================================================================

/** 사용자 역할 상수 */
export const USER_ROLES: Record<string, UserRole> = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
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
} as const;

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
// 앱 설정
// ============================================================================

export const APP_CONFIG = {
  // 초대 코드
  INVITE_CODE_LENGTH: 6,
  INVITE_EXPIRE_DAYS: 7,

  // 녹음
  MAX_RECORDING_DURATION_SEC: 120, // 2분
  AUDIO_SAMPLE_RATE: 44100,
  AUDIO_BIT_RATE: 128000,

  // API Rate Limiting
  API_RATE_LIMIT: {
    WHISPER: { maxRequests: 30, windowMinutes: 60 },
    CLAUDE: { maxRequests: 50, windowMinutes: 60 },
    TTS: { maxRequests: 20, windowMinutes: 60 },
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
} as const;
