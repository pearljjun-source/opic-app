import { Alert } from 'react-native';

// ============================================================================
// 표준화된 에러 분류 시스템
//
// 모든 에러를 AppError로 변환하여 일관된 처리를 보장
// - 대분류(ErrorCategory): 표시 방식 결정 (Toast, Alert, 배너, 인라인)
// - 세분류(ErrorCode): 한국어 메시지 결정
//
// 사용법:
//   const appError = classifyError(supabaseError, { resource: 'script' });
//   const appError = classifyRpcError('NOT_AUTHENTICATED');
//   const appError = classifyAuthError(authError);
//   const appError = new AppError('VAL_EMAIL_REQUIRED');
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  AUTH: 'auth',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
} as const;

export type ErrorCategory = typeof ERROR_CATEGORIES[keyof typeof ERROR_CATEGORIES];

export const DISPLAY_METHODS = {
  BANNER: 'banner',
  ALERT: 'alert',
  TOAST_ERROR: 'toast_error',
  TOAST_WARNING: 'toast_warning',
  INLINE: 'inline',
} as const;

export type DisplayMethod = typeof DISPLAY_METHODS[keyof typeof DISPLAY_METHODS];

export const ERROR_CODES = {
  // NETWORK (2)
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',

  // AUTH (5)
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_NOT_CONFIRMED: 'AUTH_EMAIL_NOT_CONFIRMED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_PROFILE_LOAD_FAILED: 'AUTH_PROFILE_LOAD_FAILED',

  // PERMISSION (8)
  PERM_UNAUTHORIZED: 'PERM_UNAUTHORIZED',
  PERM_NOT_STUDENT: 'PERM_NOT_STUDENT',
  PERM_NOT_TEACHER: 'PERM_NOT_TEACHER',
  PERM_ADMIN_ONLY: 'PERM_ADMIN_ONLY',
  PERM_NOT_CONNECTED: 'PERM_NOT_CONNECTED',
  PERM_NOT_CREATOR: 'PERM_NOT_CREATOR',
  PERM_INVALID_PATH: 'PERM_INVALID_PATH',
  PERM_MIC_DENIED: 'PERM_MIC_DENIED',

  // VALIDATION (10)
  VAL_EMAIL_REQUIRED: 'VAL_EMAIL_REQUIRED',
  VAL_EMAIL_INVALID: 'VAL_EMAIL_INVALID',
  VAL_PASSWORD_REQUIRED: 'VAL_PASSWORD_REQUIRED',
  VAL_PASSWORD_TOO_SHORT: 'VAL_PASSWORD_TOO_SHORT',
  VAL_PASSWORD_MISMATCH: 'VAL_PASSWORD_MISMATCH',
  VAL_NAME_REQUIRED: 'VAL_NAME_REQUIRED',
  VAL_SCRIPT_EMPTY: 'VAL_SCRIPT_EMPTY',
  VAL_INVITE_CODE_LENGTH: 'VAL_INVITE_CODE_LENGTH',
  VAL_INVITE_CODE_INVALID: 'VAL_INVITE_CODE_INVALID',
  VAL_INVITE_CODE_EXPIRED: 'VAL_INVITE_CODE_EXPIRED',

  // NOT_FOUND (11)
  NF_USER: 'NF_USER',
  NF_TEACHER: 'NF_TEACHER',
  NF_STUDENT: 'NF_STUDENT',
  NF_SCRIPT: 'NF_SCRIPT',
  NF_PRACTICE: 'NF_PRACTICE',
  NF_QUESTION: 'NF_QUESTION',
  NF_INVITE: 'NF_INVITE',
  NF_NOTIFICATION: 'NF_NOTIFICATION',
  NF_CONNECTION: 'NF_CONNECTION',
  NF_AUDIO_FILE: 'NF_AUDIO_FILE',
  NF_CLASS: 'NF_CLASS',

  // VALIDATION - class
  VAL_CLASS_NAME: 'VAL_CLASS_NAME',
  VAL_CLASS_NAME_DUPLICATE: 'VAL_CLASS_NAME_DUPLICATE',

  // CONFLICT (6)
  CONFLICT_ALREADY_CONNECTED: 'CONFLICT_ALREADY_CONNECTED',
  CONFLICT_CODE_USED: 'CONFLICT_CODE_USED',
  CONFLICT_ALREADY_TEACHER: 'CONFLICT_ALREADY_TEACHER',
  CONFLICT_EMAIL_EXISTS: 'CONFLICT_EMAIL_EXISTS',
  CONFLICT_ADMIN_PROTECTED: 'CONFLICT_ADMIN_PROTECTED',
  CONFLICT_DUPLICATE_INVITE: 'CONFLICT_DUPLICATE_INVITE',

  // RATE_LIMIT (3)
  RATE_WHISPER: 'RATE_WHISPER',
  RATE_TTS: 'RATE_TTS',
  RATE_CLAUDE: 'RATE_CLAUDE',

  // ADMIN (5)
  ADMIN_LAST_ADMIN_PROTECTION: 'ADMIN_LAST_ADMIN_PROTECTION',
  ADMIN_UPLOAD_FAILED: 'ADMIN_UPLOAD_FAILED',
  ADMIN_REORDER_FAILED: 'ADMIN_REORDER_FAILED',
  ADMIN_RECENT_ACTIONS: 'ADMIN_RECENT_ACTIONS',
  ADMIN_SUB_SAME_PLAN: 'ADMIN_SUB_SAME_PLAN',

  // BILLING (7)
  BILLING_KEY_FAILED: 'BILLING_KEY_FAILED',
  BILLING_PAYMENT_FAILED: 'BILLING_PAYMENT_FAILED',
  BILLING_ALREADY_SUBSCRIBED: 'BILLING_ALREADY_SUBSCRIBED',
  BILLING_CANCEL_FAILED: 'BILLING_CANCEL_FAILED',
  BILLING_FEATURE_NOT_AVAILABLE: 'BILLING_FEATURE_NOT_AVAILABLE',
  BILLING_QUOTA_EXCEEDED: 'BILLING_QUOTA_EXCEEDED',
  BILLING_SUBSCRIPTION_EXPIRED: 'BILLING_SUBSCRIPTION_EXPIRED',

  // DOWNGRADE (2)
  DOWNGRADE_STUDENT_LIMIT: 'DOWNGRADE_STUDENT_LIMIT',
  DOWNGRADE_SCRIPT_LIMIT: 'DOWNGRADE_SCRIPT_LIMIT',

  // VALIDATION (additional)
  VAL_FAILED: 'VAL_FAILED',
  CONFLICT_TEACHER_HAS_STUDENTS: 'CONFLICT_TEACHER_HAS_STUDENTS',

  // NOT_FOUND (additional)
  NF_SUBSCRIPTION: 'NF_SUBSCRIPTION',
  NF_PLAN: 'NF_PLAN',
  NF_LANDING_SECTION: 'NF_LANDING_SECTION',

  // ORGANIZATION (9)
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  ORG_ALREADY_MEMBER: 'ORG_ALREADY_MEMBER',
  ORG_LAST_OWNER: 'ORG_LAST_OWNER',
  ORG_TEACHER_NOT_IN_ORG: 'ORG_TEACHER_NOT_IN_ORG',
  ORG_STUDENT_NOT_IN_ORG: 'ORG_STUDENT_NOT_IN_ORG',
  ORG_OWNER_ONLY: 'ORG_OWNER_ONLY',
  ORG_NO_MEMBERSHIP: 'ORG_NO_MEMBERSHIP',
  ORG_NAME_REQUIRED: 'ORG_NAME_REQUIRED',
  ORG_NAME_TOO_LONG: 'ORG_NAME_TOO_LONG',

  // SERVER (10)
  SVR_WHISPER_API: 'SVR_WHISPER_API',
  SVR_TTS_API: 'SVR_TTS_API',
  SVR_CLAUDE_API: 'SVR_CLAUDE_API',
  SVR_PUSH_API: 'SVR_PUSH_API',
  SVR_STORAGE_UPLOAD: 'SVR_STORAGE_UPLOAD',
  SVR_STORAGE_DOWNLOAD: 'SVR_STORAGE_DOWNLOAD',
  SVR_STORAGE_URL: 'SVR_STORAGE_URL',
  SVR_DATABASE: 'SVR_DATABASE',
  SVR_API_KEY_MISSING: 'SVR_API_KEY_MISSING',
  SVR_UNKNOWN: 'SVR_UNKNOWN',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface ErrorContext {
  resource?: 'script' | 'practice' | 'invite' | 'connection' | 'user' | 'student' | 'teacher' | 'question' | 'notification' | 'audio' | 'class' | 'topic' | 'subscription' | 'plan' | 'landing_section' | 'landing_item' | 'organization';
  field?: string;
  apiType?: 'whisper' | 'tts' | 'claude' | 'push';
}

export interface AppErrorMetadata {
  originalError?: unknown;
  remaining?: number;
  resetAt?: string;
  statusCode?: number;
  field?: string;
  [key: string]: unknown;
}

// ============================================================================
// Mapping Tables
// ============================================================================

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // NETWORK
  NETWORK_OFFLINE: '인터넷 연결을 확인해주세요',
  NETWORK_TIMEOUT: '서버 응답이 없습니다. 잠시 후 다시 시도해주세요',

  // AUTH
  AUTH_REQUIRED: '로그인이 필요합니다',
  AUTH_INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다',
  AUTH_EMAIL_NOT_CONFIRMED: '이메일 인증이 필요합니다. 메일함을 확인해주세요',
  AUTH_SESSION_EXPIRED: '로그인이 만료되었습니다. 다시 로그인해주세요',
  AUTH_PROFILE_LOAD_FAILED: '사용자 정보를 불러올 수 없습니다',

  // PERMISSION
  PERM_UNAUTHORIZED: '접근 권한이 없습니다',
  PERM_NOT_STUDENT: '학생 계정만 이용 가능합니다',
  PERM_NOT_TEACHER: '강사 계정만 이용 가능합니다',
  PERM_ADMIN_ONLY: '관리자만 수행할 수 있습니다',
  PERM_NOT_CONNECTED: '연결된 학생/강사가 아닙니다',
  PERM_NOT_CREATOR: '본인이 생성한 항목만 수정할 수 있습니다',
  PERM_INVALID_PATH: '잘못된 파일 경로입니다',
  PERM_MIC_DENIED: '마이크 권한이 필요합니다. 설정에서 허용해주세요',

  // VALIDATION
  VAL_EMAIL_REQUIRED: '이메일을 입력해주세요',
  VAL_EMAIL_INVALID: '올바른 이메일 형식이 아닙니다',
  VAL_PASSWORD_REQUIRED: '비밀번호를 입력해주세요',
  VAL_PASSWORD_TOO_SHORT: '비밀번호는 6자 이상이어야 합니다',
  VAL_PASSWORD_MISMATCH: '비밀번호가 일치하지 않습니다',
  VAL_NAME_REQUIRED: '이름을 입력해주세요',
  VAL_SCRIPT_EMPTY: '스크립트 내용을 입력해주세요',
  VAL_INVITE_CODE_LENGTH: '초대 코드 6자리를 입력해주세요',
  VAL_INVITE_CODE_INVALID: '유효하지 않은 초대 코드입니다',
  VAL_INVITE_CODE_EXPIRED: '만료된 초대 코드입니다',
  VAL_CLASS_NAME: '반 이름을 입력해주세요',
  VAL_CLASS_NAME_DUPLICATE: '같은 이름의 반이 이미 존재합니다',

  // ADMIN
  ADMIN_LAST_ADMIN_PROTECTION: '최소 1명의 관리자가 필요합니다',
  ADMIN_UPLOAD_FAILED: '파일 업로드에 실패했습니다',
  ADMIN_REORDER_FAILED: '순서 변경에 실패했습니다',
  ADMIN_RECENT_ACTIONS: '최근 관리 활동이 있어 강등할 수 없습니다',
  ADMIN_SUB_SAME_PLAN: '이미 동일한 플랜을 사용 중입니다',

  // BILLING
  BILLING_KEY_FAILED: '결제 수단 등록에 실패했습니다',
  BILLING_PAYMENT_FAILED: '결제에 실패했습니다',
  BILLING_ALREADY_SUBSCRIBED: '이미 구독 중입니다',
  BILLING_CANCEL_FAILED: '구독 취소에 실패했습니다',
  BILLING_FEATURE_NOT_AVAILABLE: '현재 플랜에서는 이용할 수 없는 기능입니다. 플랜을 업그레이드해 주세요.',
  BILLING_QUOTA_EXCEEDED: '플랜 한도에 도달했습니다. 플랜을 업그레이드해 주세요.',
  BILLING_SUBSCRIPTION_EXPIRED: '구독이 만료되었습니다',

  // DOWNGRADE
  DOWNGRADE_STUDENT_LIMIT: '현재 학생 수가 변경할 플랜의 한도를 초과합니다',
  DOWNGRADE_SCRIPT_LIMIT: '현재 스크립트 수가 변경할 플랜의 한도를 초과합니다',

  // VALIDATION (additional)
  VAL_FAILED: '입력값이 올바르지 않습니다',
  CONFLICT_TEACHER_HAS_STUDENTS: '활성 학생이 있어 강등할 수 없습니다',

  // NOT_FOUND (additional)
  NF_SUBSCRIPTION: '구독 정보를 찾을 수 없습니다',
  NF_PLAN: '구독 플랜을 찾을 수 없습니다',
  NF_LANDING_SECTION: '랜딩 섹션을 찾을 수 없습니다',

  // NOT_FOUND
  NF_USER: '사용자를 찾을 수 없습니다',
  NF_TEACHER: '강사를 찾을 수 없습니다',
  NF_STUDENT: '학생을 찾을 수 없습니다',
  NF_SCRIPT: '스크립트를 찾을 수 없습니다',
  NF_PRACTICE: '연습 기록을 찾을 수 없습니다',
  NF_QUESTION: '질문을 찾을 수 없습니다',
  NF_INVITE: '초대 코드를 찾을 수 없습니다',
  NF_NOTIFICATION: '알림을 찾을 수 없습니다',
  NF_CONNECTION: '연결 정보를 찾을 수 없습니다',
  NF_AUDIO_FILE: '오디오 파일을 찾을 수 없습니다',
  NF_CLASS: '반을 찾을 수 없습니다',

  // CONFLICT
  CONFLICT_ALREADY_CONNECTED: '이미 연결된 강사입니다',
  CONFLICT_CODE_USED: '다른 사용자가 먼저 코드를 사용했습니다',
  CONFLICT_ALREADY_TEACHER: '이미 강사 계정입니다',
  CONFLICT_EMAIL_EXISTS: '이미 등록된 이메일입니다',
  CONFLICT_ADMIN_PROTECTED: '관리자 계정은 변경할 수 없습니다',
  CONFLICT_DUPLICATE_INVITE: '동일한 이름의 대기 중인 초대가 이미 있습니다',

  // RATE_LIMIT
  RATE_WHISPER: '음성 변환 요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
  RATE_TTS: '오디오 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
  RATE_CLAUDE: 'AI 분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요',

  // ORGANIZATION
  ORG_NOT_FOUND: '학원을 찾을 수 없습니다',
  ORG_ALREADY_MEMBER: '이미 가입된 학원입니다',
  ORG_LAST_OWNER: '학원에 최소 1명의 원장이 필요합니다',
  ORG_TEACHER_NOT_IN_ORG: '해당 학원의 강사가 아닙니다',
  ORG_STUDENT_NOT_IN_ORG: '해당 학원의 학생이 아닙니다',
  ORG_OWNER_ONLY: '원장만 사용할 수 있는 기능입니다',
  ORG_NO_MEMBERSHIP: '학원에 가입되어 있지 않습니다',
  ORG_NAME_REQUIRED: '학원 이름을 입력해주세요',
  ORG_NAME_TOO_LONG: '학원 이름은 100자 이내로 입력해주세요',

  // SERVER
  SVR_WHISPER_API: '음성 변환에 실패했습니다. 다시 시도해주세요',
  SVR_TTS_API: '오디오 생성에 실패했습니다. 다시 시도해주세요',
  SVR_CLAUDE_API: 'AI 분석에 실패했습니다. 다시 시도해주세요',
  SVR_PUSH_API: '알림 전송에 실패했습니다',
  SVR_STORAGE_UPLOAD: '파일 업로드에 실패했습니다. 다시 시도해주세요',
  SVR_STORAGE_DOWNLOAD: '파일을 불러올 수 없습니다',
  SVR_STORAGE_URL: '오디오 URL 생성에 실패했습니다',
  SVR_DATABASE: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
  SVR_API_KEY_MISSING: '서버 설정 오류입니다. 관리자에게 문의해주세요',
  SVR_UNKNOWN: '알 수 없는 오류가 발생했습니다',
};

const ERROR_CODE_CATEGORY: Record<ErrorCode, ErrorCategory> = {
  NETWORK_OFFLINE: 'network',
  NETWORK_TIMEOUT: 'network',
  AUTH_REQUIRED: 'auth',
  AUTH_INVALID_CREDENTIALS: 'auth',
  AUTH_EMAIL_NOT_CONFIRMED: 'auth',
  AUTH_SESSION_EXPIRED: 'auth',
  AUTH_PROFILE_LOAD_FAILED: 'auth',
  PERM_UNAUTHORIZED: 'permission',
  PERM_NOT_STUDENT: 'permission',
  PERM_NOT_TEACHER: 'permission',
  PERM_ADMIN_ONLY: 'permission',
  PERM_NOT_CONNECTED: 'permission',
  PERM_NOT_CREATOR: 'permission',
  PERM_INVALID_PATH: 'permission',
  PERM_MIC_DENIED: 'permission',
  VAL_EMAIL_REQUIRED: 'validation',
  VAL_EMAIL_INVALID: 'validation',
  VAL_PASSWORD_REQUIRED: 'validation',
  VAL_PASSWORD_TOO_SHORT: 'validation',
  VAL_PASSWORD_MISMATCH: 'validation',
  VAL_NAME_REQUIRED: 'validation',
  VAL_SCRIPT_EMPTY: 'validation',
  VAL_INVITE_CODE_LENGTH: 'validation',
  VAL_INVITE_CODE_INVALID: 'validation',
  VAL_INVITE_CODE_EXPIRED: 'validation',
  VAL_CLASS_NAME: 'validation',
  VAL_CLASS_NAME_DUPLICATE: 'validation',
  ADMIN_LAST_ADMIN_PROTECTION: 'permission',
  ADMIN_UPLOAD_FAILED: 'server',
  ADMIN_REORDER_FAILED: 'server',
  ADMIN_RECENT_ACTIONS: 'conflict',
  ADMIN_SUB_SAME_PLAN: 'conflict',
  BILLING_KEY_FAILED: 'server',
  BILLING_PAYMENT_FAILED: 'server',
  BILLING_ALREADY_SUBSCRIBED: 'conflict',
  BILLING_CANCEL_FAILED: 'server',
  BILLING_FEATURE_NOT_AVAILABLE: 'permission',
  BILLING_QUOTA_EXCEEDED: 'permission',
  BILLING_SUBSCRIPTION_EXPIRED: 'permission',
  DOWNGRADE_STUDENT_LIMIT: 'conflict',
  DOWNGRADE_SCRIPT_LIMIT: 'conflict',
  VAL_FAILED: 'validation',
  CONFLICT_TEACHER_HAS_STUDENTS: 'conflict',
  NF_SUBSCRIPTION: 'not_found',
  NF_PLAN: 'not_found',
  NF_LANDING_SECTION: 'not_found',
  NF_USER: 'not_found',
  NF_TEACHER: 'not_found',
  NF_STUDENT: 'not_found',
  NF_SCRIPT: 'not_found',
  NF_PRACTICE: 'not_found',
  NF_QUESTION: 'not_found',
  NF_INVITE: 'not_found',
  NF_NOTIFICATION: 'not_found',
  NF_CONNECTION: 'not_found',
  NF_AUDIO_FILE: 'not_found',
  NF_CLASS: 'not_found',
  CONFLICT_ALREADY_CONNECTED: 'conflict',
  CONFLICT_CODE_USED: 'conflict',
  CONFLICT_ALREADY_TEACHER: 'conflict',
  CONFLICT_EMAIL_EXISTS: 'conflict',
  CONFLICT_ADMIN_PROTECTED: 'conflict',
  CONFLICT_DUPLICATE_INVITE: 'conflict',
  RATE_WHISPER: 'rate_limit',
  RATE_TTS: 'rate_limit',
  RATE_CLAUDE: 'rate_limit',
  ORG_NOT_FOUND: 'not_found',
  ORG_ALREADY_MEMBER: 'conflict',
  ORG_LAST_OWNER: 'permission',
  ORG_TEACHER_NOT_IN_ORG: 'permission',
  ORG_STUDENT_NOT_IN_ORG: 'permission',
  ORG_OWNER_ONLY: 'permission',
  ORG_NO_MEMBERSHIP: 'permission',
  ORG_NAME_REQUIRED: 'validation',
  ORG_NAME_TOO_LONG: 'validation',
  SVR_WHISPER_API: 'server',
  SVR_TTS_API: 'server',
  SVR_CLAUDE_API: 'server',
  SVR_PUSH_API: 'server',
  SVR_STORAGE_UPLOAD: 'server',
  SVR_STORAGE_DOWNLOAD: 'server',
  SVR_STORAGE_URL: 'server',
  SVR_DATABASE: 'server',
  SVR_API_KEY_MISSING: 'server',
  SVR_UNKNOWN: 'server',
};

export const CATEGORY_CONFIG: Record<ErrorCategory, {
  displayMethod: DisplayMethod;
  isRetryable: boolean;
}> = {
  network: { displayMethod: 'banner', isRetryable: true },
  auth: { displayMethod: 'alert', isRetryable: false },
  permission: { displayMethod: 'toast_error', isRetryable: false },
  validation: { displayMethod: 'inline', isRetryable: false },
  not_found: { displayMethod: 'toast_error', isRetryable: false },
  conflict: { displayMethod: 'toast_warning', isRetryable: false },
  rate_limit: { displayMethod: 'toast_warning', isRetryable: true },
  server: { displayMethod: 'toast_error', isRetryable: true },
};

// ============================================================================
// AppError Class
// ============================================================================

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly userMessage: string;
  readonly displayMethod: DisplayMethod;
  readonly isRetryable: boolean;
  readonly metadata: AppErrorMetadata;

  constructor(code: ErrorCode, metadata?: AppErrorMetadata) {
    const userMessage = ERROR_MESSAGES[code];
    super(userMessage);
    this.name = 'AppError';
    this.code = code;
    this.category = ERROR_CODE_CATEGORY[code];
    this.userMessage = userMessage;
    this.displayMethod = CATEGORY_CONFIG[this.category].displayMethod;
    this.isRetryable = CATEGORY_CONFIG[this.category].isRetryable;
    this.metadata = metadata ?? {};
  }

  /** 동적 메시지가 필요한 경우 (rate limit 등) */
  static withMessage(code: ErrorCode, message: string, metadata?: AppErrorMetadata): AppError {
    const error = new AppError(code, metadata);
    Object.defineProperty(error, 'userMessage', { value: message });
    Object.defineProperty(error, 'message', { value: message });
    return error;
  }
}

// ============================================================================
// Private: Error Source Mapping Tables
// ============================================================================

/** RPC 함수가 반환하는 에러 문자열 → ErrorCode */
const RPC_ERROR_MAP: Record<string, ErrorCode> = {
  'NOT_AUTHENTICATED': ERROR_CODES.AUTH_REQUIRED,
  'USER_NOT_FOUND': ERROR_CODES.NF_USER,
  'NOT_TEACHER': ERROR_CODES.PERM_NOT_TEACHER,
  'NOT_STUDENT': ERROR_CODES.PERM_NOT_STUDENT,
  'INVALID_CODE': ERROR_CODES.VAL_INVITE_CODE_INVALID,
  'CODE_ALREADY_USED': ERROR_CODES.CONFLICT_CODE_USED,
  'TEACHER_NOT_FOUND': ERROR_CODES.NF_TEACHER,
  'ALREADY_CONNECTED': ERROR_CODES.CONFLICT_ALREADY_CONNECTED,
  'STUDENT_NOT_FOUND': ERROR_CODES.NF_STUDENT,
  'NOT_CONNECTED': ERROR_CODES.PERM_NOT_CONNECTED,
  'UNAUTHORIZED': ERROR_CODES.PERM_UNAUTHORIZED,
  'INVALID_TYPE': ERROR_CODES.PERM_UNAUTHORIZED,
  'ADMIN_ONLY': ERROR_CODES.PERM_ADMIN_ONLY,
  'ALREADY_TEACHER': ERROR_CODES.CONFLICT_ALREADY_TEACHER,
  'CANNOT_CHANGE_ADMIN': ERROR_CODES.CONFLICT_ADMIN_PROTECTED,
  'CLASS_NAME_REQUIRED': ERROR_CODES.VAL_CLASS_NAME,
  'CLASS_NAME_DUPLICATE': ERROR_CODES.VAL_CLASS_NAME_DUPLICATE,
  // Organization RPC errors
  'NOT_IN_ORG': ERROR_CODES.ORG_NO_MEMBERSHIP,
  'OWNER_ONLY': ERROR_CODES.ORG_OWNER_ONLY,
  'LAST_OWNER': ERROR_CODES.ORG_LAST_OWNER,
  'TEACHER_NOT_IN_ORG': ERROR_CODES.ORG_TEACHER_NOT_IN_ORG,
  'STUDENT_NOT_IN_ORG': ERROR_CODES.ORG_STUDENT_NOT_IN_ORG,
  'MEMBER_NOT_FOUND': ERROR_CODES.NF_USER,
  'CANNOT_REMOVE_SELF': ERROR_CODES.ORG_LAST_OWNER,
  'CANNOT_DEMOTE_SELF': ERROR_CODES.ORG_LAST_OWNER,
  'CANNOT_INVITE_OWNER': ERROR_CODES.ORG_OWNER_ONLY,
  'ORG_NAME_REQUIRED': ERROR_CODES.ORG_NAME_REQUIRED,
  'ORG_NAME_TOO_LONG': ERROR_CODES.ORG_NAME_TOO_LONG,
  'ORG_NOT_FOUND': ERROR_CODES.ORG_NOT_FOUND,
  'ORG_INVALID_SLUG': ERROR_CODES.VAL_FAILED,
  'ORG_SLUG_TAKEN': ERROR_CODES.ORG_ALREADY_MEMBER,
  'CANNOT_USE_OWN_CODE': ERROR_CODES.VAL_INVITE_CODE_INVALID,
  'INVITE_NOT_FOUND': ERROR_CODES.NF_INVITE,
  'INVITE_ALREADY_USED': ERROR_CODES.CONFLICT_CODE_USED,
  'INVALID_EXPIRES_DAYS': ERROR_CODES.VAL_FAILED,
  'DUPLICATE_ORG_NAME_INVITE': ERROR_CODES.CONFLICT_DUPLICATE_INVITE,
  // Admin dashboard RPC errors
  'LAST_ADMIN': ERROR_CODES.ADMIN_LAST_ADMIN_PROTECTION,
  'ADMIN_RECENT_ACTIONS': ERROR_CODES.ADMIN_RECENT_ACTIONS,
  'TEACHER_HAS_STUDENTS': ERROR_CODES.CONFLICT_TEACHER_HAS_STUDENTS,
  'DOWNGRADE_STUDENT_LIMIT': ERROR_CODES.DOWNGRADE_STUDENT_LIMIT,
  'DOWNGRADE_SCRIPT_LIMIT': ERROR_CODES.DOWNGRADE_SCRIPT_LIMIT,
  'SECTION_NOT_FOUND': ERROR_CODES.NF_LANDING_SECTION,
  'PLAN_NOT_FOUND': ERROR_CODES.NF_PLAN,
  'SAME_PLAN': ERROR_CODES.ADMIN_SUB_SAME_PLAN,
  // Subscription / Feature gating
  'FEATURE_NOT_AVAILABLE': ERROR_CODES.BILLING_FEATURE_NOT_AVAILABLE,
  'FREE_PLAN': ERROR_CODES.BILLING_FEATURE_NOT_AVAILABLE,
  'SUBSCRIPTION_EXPIRED': ERROR_CODES.BILLING_SUBSCRIPTION_EXPIRED,
  'QUOTA_EXCEEDED': ERROR_CODES.BILLING_QUOTA_EXCEEDED,
  'NOT_ORG_OWNER': ERROR_CODES.ORG_OWNER_ONLY,
};

/** Supabase AuthError 메시지 패턴 → ErrorCode (우선순위 순) */
const AUTH_ERROR_PATTERNS: Array<{ pattern: string; code: ErrorCode }> = [
  { pattern: 'invalid login credentials', code: ERROR_CODES.AUTH_INVALID_CREDENTIALS },
  { pattern: 'email not confirmed', code: ERROR_CODES.AUTH_EMAIL_NOT_CONFIRMED },
  { pattern: 'invalid claim', code: ERROR_CODES.AUTH_SESSION_EXPIRED },
  { pattern: 'jwt expired', code: ERROR_CODES.AUTH_SESSION_EXPIRED },
  { pattern: 'refresh_token_not_found', code: ERROR_CODES.AUTH_SESSION_EXPIRED },
  { pattern: 'token is expired', code: ERROR_CODES.AUTH_SESSION_EXPIRED },
  { pattern: 'already registered', code: ERROR_CODES.CONFLICT_EMAIL_EXISTS },
  { pattern: 'user not found', code: ERROR_CODES.NF_USER },
  { pattern: 'password should be at least', code: ERROR_CODES.VAL_PASSWORD_TOO_SHORT },
];

// ============================================================================
// Private: Type Guards
// ============================================================================

function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }
  return '';
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    (error instanceof TypeError && msg.includes('network'));
}

function isPostgrestError(error: unknown): error is { code: string; message: string; details?: string } {
  if (typeof error !== 'object' || error === null) return false;
  const obj = error as Record<string, unknown>;
  if (typeof obj.code !== 'string' || typeof obj.message !== 'string') return false;
  return obj.code.startsWith('PGRST') || /^\d{5}$/.test(obj.code);
}

function isAuthError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const obj = error as Record<string, unknown>;
  return obj.__isAuthError === true ||
    obj.name === 'AuthApiError' ||
    obj.name === 'AuthError';
}

function isFunctionsHttpError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const obj = error as Record<string, unknown>;
  return obj.name === 'FunctionsHttpError' ||
    obj.name === 'FunctionsRelayError' ||
    (typeof obj.context === 'object' && obj.context !== null);
}

function isRateLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const obj = error as Record<string, unknown>;
  if (obj.status === 429) return true;
  const ctx = obj.context as Record<string, unknown> | undefined;
  if (ctx && typeof ctx === 'object') {
    return typeof ctx.remaining === 'number' && typeof ctx.reset_at === 'string';
  }
  return false;
}

// ============================================================================
// Private: Individual Classifiers
// ============================================================================

function classifyNotFoundByContext(context?: ErrorContext, originalError?: unknown): AppError {
  const resourceMap: Record<string, ErrorCode> = {
    script: ERROR_CODES.NF_SCRIPT,
    practice: ERROR_CODES.NF_PRACTICE,
    invite: ERROR_CODES.NF_INVITE,
    connection: ERROR_CODES.NF_CONNECTION,
    user: ERROR_CODES.NF_USER,
    student: ERROR_CODES.NF_STUDENT,
    teacher: ERROR_CODES.NF_TEACHER,
    question: ERROR_CODES.NF_QUESTION,
    notification: ERROR_CODES.NF_NOTIFICATION,
    audio: ERROR_CODES.NF_AUDIO_FILE,
    class: ERROR_CODES.NF_CLASS,
    subscription: ERROR_CODES.NF_SUBSCRIPTION,
    plan: ERROR_CODES.NF_PLAN,
    landing_section: ERROR_CODES.NF_LANDING_SECTION,
    landing_item: ERROR_CODES.NF_LANDING_SECTION,
    organization: ERROR_CODES.ORG_NOT_FOUND,
  };

  const code = context?.resource
    ? (resourceMap[context.resource] ?? ERROR_CODES.SVR_DATABASE)
    : ERROR_CODES.SVR_DATABASE;
  return new AppError(code, { originalError });
}

function classifyNetworkError(error: unknown): AppError {
  const msg = extractMessage(error).toLowerCase();
  if (msg.includes('timeout') || msg.includes('aborted')) {
    return new AppError(ERROR_CODES.NETWORK_TIMEOUT, { originalError: error });
  }
  return new AppError(ERROR_CODES.NETWORK_OFFLINE, { originalError: error });
}

function classifyPostgrestError(
  error: { code: string; message: string; details?: string },
  context?: ErrorContext
): AppError {
  // PGRST116: .single()에서 행 없음
  if (error.code === 'PGRST116') {
    return classifyNotFoundByContext(context, error);
  }
  // 42501: RLS 권한 위반
  if (error.code === '42501') {
    return new AppError(ERROR_CODES.PERM_UNAUTHORIZED, { originalError: error });
  }
  // 23505: UNIQUE 제약 위반
  if (error.code === '23505') {
    if (error.message.toLowerCase().includes('email')) {
      return new AppError(ERROR_CODES.CONFLICT_EMAIL_EXISTS, { originalError: error });
    }
    return new AppError(ERROR_CODES.SVR_DATABASE, { originalError: error });
  }
  // 23503: 외래키 위반 (참조 리소스 없음)
  if (error.code === '23503') {
    return classifyNotFoundByContext(context, error);
  }
  return new AppError(ERROR_CODES.SVR_DATABASE, { originalError: error });
}

function classifyRateLimitError(error: unknown, context?: ErrorContext): AppError {
  const obj = error as Record<string, unknown>;
  const ctx = (typeof obj.context === 'object' && obj.context !== null
    ? obj.context
    : obj) as Record<string, unknown>;
  const remaining = typeof ctx.remaining === 'number' ? ctx.remaining : undefined;
  const resetAt = typeof ctx.reset_at === 'string' ? ctx.reset_at : undefined;

  let code: ErrorCode;
  if (context?.apiType === 'whisper') code = ERROR_CODES.RATE_WHISPER;
  else if (context?.apiType === 'tts') code = ERROR_CODES.RATE_TTS;
  else if (context?.apiType === 'claude') code = ERROR_CODES.RATE_CLAUDE;
  else {
    const msg = extractMessage(error).toLowerCase();
    if (msg.includes('whisper') || msg.includes('stt')) code = ERROR_CODES.RATE_WHISPER;
    else if (msg.includes('tts')) code = ERROR_CODES.RATE_TTS;
    else if (msg.includes('claude') || msg.includes('feedback')) code = ERROR_CODES.RATE_CLAUDE;
    else code = ERROR_CODES.RATE_WHISPER;
  }

  if (resetAt) {
    const resetDate = new Date(resetAt);
    const now = new Date();
    const diffMin = Math.max(1, Math.ceil((resetDate.getTime() - now.getTime()) / 60000));
    const dynamicMessage = `요청 한도를 초과했습니다. ${diffMin}분 후 다시 시도해주세요`;
    return AppError.withMessage(code, dynamicMessage, { originalError: error, remaining, resetAt });
  }

  return new AppError(code, { originalError: error, remaining, resetAt });
}

function classifyFunctionsError(error: unknown, context?: ErrorContext): AppError {
  const obj = error as Record<string, unknown>;
  const ctx = obj.context as Record<string, unknown> | undefined;

  let errorMessage = '';
  if (ctx && typeof ctx === 'object' && typeof ctx.error === 'string') {
    errorMessage = ctx.error;
  } else {
    errorMessage = extractMessage(error);
  }

  const msgLower = errorMessage.toLowerCase();

  if (msgLower.includes('not configured') || msgLower.includes('api_key')) {
    return new AppError(ERROR_CODES.SVR_API_KEY_MISSING, { originalError: error });
  }
  if (msgLower === 'unauthorized') {
    return new AppError(ERROR_CODES.AUTH_REQUIRED, { originalError: error });
  }
  if (msgLower.includes('whisper api error')) {
    return new AppError(ERROR_CODES.SVR_WHISPER_API, { originalError: error });
  }
  if (msgLower.includes('tts api error')) {
    return new AppError(ERROR_CODES.SVR_TTS_API, { originalError: error });
  }
  if (msgLower.includes('claude api error')) {
    return new AppError(ERROR_CODES.SVR_CLAUDE_API, { originalError: error });
  }
  if (msgLower.includes('storage upload error') || msgLower.includes('upload error')) {
    return new AppError(ERROR_CODES.SVR_STORAGE_UPLOAD, { originalError: error });
  }
  if (msgLower.includes('failed to download') || msgLower.includes('download')) {
    return new AppError(ERROR_CODES.SVR_STORAGE_DOWNLOAD, { originalError: error });
  }
  if (msgLower.includes('question not found')) {
    return new AppError(ERROR_CODES.NF_QUESTION, { originalError: error });
  }
  if (msgLower.includes('invalid audio path')) {
    return new AppError(ERROR_CODES.PERM_INVALID_PATH, { originalError: error });
  }
  if (msgLower.includes('notification not found')) {
    return new AppError(ERROR_CODES.NF_NOTIFICATION, { originalError: error });
  }
  if (msgLower.includes('not the notification creator')) {
    return new AppError(ERROR_CODES.PERM_NOT_CREATOR, { originalError: error });
  }
  if (msgLower.includes('rate limit')) {
    return classifyRateLimitError(error, context);
  }

  // apiType context에 의한 fallback
  if (context?.apiType === 'whisper') return new AppError(ERROR_CODES.SVR_WHISPER_API, { originalError: error });
  if (context?.apiType === 'tts') return new AppError(ERROR_CODES.SVR_TTS_API, { originalError: error });
  if (context?.apiType === 'claude') return new AppError(ERROR_CODES.SVR_CLAUDE_API, { originalError: error });
  if (context?.apiType === 'push') return new AppError(ERROR_CODES.SVR_PUSH_API, { originalError: error });

  return new AppError(ERROR_CODES.SVR_UNKNOWN, { originalError: error });
}

function classifyGenericError(error: Error, context?: ErrorContext): AppError {
  const msg = error.message.toLowerCase();

  // 인증
  if (msg === 'not authenticated' || msg.includes('not authenticated')) {
    return new AppError(ERROR_CODES.AUTH_REQUIRED, { originalError: error });
  }
  if (msg === 'unauthorized') {
    return new AppError(ERROR_CODES.PERM_UNAUTHORIZED, { originalError: error });
  }

  // Not Found (서비스 레이어 메시지)
  if (msg === 'practice not found') return new AppError(ERROR_CODES.NF_PRACTICE, { originalError: error });
  if (msg === 'script not found') return new AppError(ERROR_CODES.NF_SCRIPT, { originalError: error });
  if (msg === 'connection not found') return new AppError(ERROR_CODES.NF_CONNECTION, { originalError: error });
  if (msg === 'student not connected') return new AppError(ERROR_CODES.PERM_NOT_CONNECTED, { originalError: error });

  // 마이크 권한
  if (msg.includes('microphone') || msg.includes('recording permission')) {
    return new AppError(ERROR_CODES.PERM_MIC_DENIED, { originalError: error });
  }

  // 스토리지
  if (msg.includes('storage') && msg.includes('upload')) {
    return new AppError(ERROR_CODES.SVR_STORAGE_UPLOAD, { originalError: error });
  }

  // context 기반 fallback
  if (context) {
    return classifyNotFoundByContext(context, error);
  }

  return new AppError(ERROR_CODES.SVR_UNKNOWN, { originalError: error });
}

// ============================================================================
// Public: Classifier Functions
// ============================================================================

/** Supabase AuthError 분류 */
export function classifyAuthError(error: unknown): AppError {
  const message = extractMessage(error).toLowerCase();

  for (const { pattern, code } of AUTH_ERROR_PATTERNS) {
    if (message.includes(pattern)) {
      return new AppError(code, { originalError: error });
    }
  }

  return new AppError(ERROR_CODES.AUTH_REQUIRED, { originalError: error });
}

/** RPC 함수 에러 문자열 분류 */
export function classifyRpcError(errorString: string, context?: ErrorContext): AppError {
  const trimmed = errorString.trim().toUpperCase();

  // 직접 매핑
  const directMatch = RPC_ERROR_MAP[trimmed];
  if (directMatch) {
    return new AppError(directMatch, { originalError: errorString });
  }

  // context 기반 NOT_FOUND
  if (trimmed === 'NOT_FOUND' || trimmed === 'RESOURCE_NOT_FOUND') {
    return classifyNotFoundByContext(context, errorString);
  }

  return new AppError(ERROR_CODES.SVR_UNKNOWN, { originalError: errorString });
}

/** 메인 에러 분류기: 모든 에러 소스를 처리 */
export function classifyError(error: unknown, context?: ErrorContext): AppError {
  // 이미 분류됨
  if (error instanceof AppError) {
    return error;
  }

  // null/undefined
  if (error == null) {
    return new AppError(ERROR_CODES.SVR_UNKNOWN);
  }

  // 문자열 (RPC 에러 코드)
  if (typeof error === 'string') {
    return classifyRpcError(error, context);
  }

  // 네트워크 에러
  if (isNetworkError(error)) {
    return classifyNetworkError(error);
  }

  // Rate Limit (429)
  if (isRateLimitError(error)) {
    return classifyRateLimitError(error, context);
  }

  // PostgrestError (.code: PGRST* 또는 5자리 숫자)
  if (isPostgrestError(error)) {
    return classifyPostgrestError(error, context);
  }

  // Supabase AuthError
  if (isAuthError(error)) {
    return classifyAuthError(error);
  }

  // Edge Function 에러 (.context 존재)
  if (isFunctionsHttpError(error)) {
    return classifyFunctionsError(error, context);
  }

  // 일반 Error 객체
  if (error instanceof Error) {
    return classifyGenericError(error, context);
  }

  // { error: string } 형태의 객체 (RPC 결과)
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.error === 'string') {
      return classifyRpcError(obj.error, context);
    }
    if (typeof obj.message === 'string') {
      return classifyGenericError(new Error(obj.message), context);
    }
  }

  return new AppError(ERROR_CODES.SVR_UNKNOWN, { originalError: error });
}

// ============================================================================
// Public: Utility Functions
// ============================================================================

/** AppError 타입 가드 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** 에러에서 표시 방식 추출 */
export function getDisplayMethod(error: unknown): DisplayMethod {
  if (error instanceof AppError) return error.displayMethod;
  return DISPLAY_METHODS.TOAST_ERROR;
}

/** 에러에서 사용자 메시지 추출 */
export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return ERROR_MESSAGES.SVR_UNKNOWN;
}

/** 에러 분류 + 표시 (Toast 미설치 상태에서 Alert.alert 사용) */
export function handleError(error: unknown, context?: ErrorContext): AppError {
  const appError = classifyError(error, context);
  if (appError.displayMethod !== 'inline') {
    Alert.alert('오류', appError.userMessage);
  }
  if (__DEV__) {
    console.warn(`[AppError] ${appError.code}:`, appError.metadata.originalError);
  }
  return appError;
}
