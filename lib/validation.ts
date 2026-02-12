// ============================================================================
// OPIc 학습 앱 - 유효성 검사 함수
// ============================================================================

import { APP_CONFIG } from './constants';

// ============================================================================
// 텍스트 정제 (XSS 방지)
// ============================================================================

export function sanitizeText(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// ============================================================================
// 오디오 파일 검증
// ============================================================================

const ALLOWED_AUDIO_TYPES = ['audio/m4a', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'audio/mpeg'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MIN_RECORDING_DURATION = 5; // 최소 5초
const MAX_RECORDING_DURATION = APP_CONFIG.MAX_RECORDING_DURATION_SEC; // 최대 120초

export interface AudioValidationResult {
  valid: boolean;
  message: string;
}

export function validateAudioFile(file: { type: string; size: number }): AudioValidationResult {
  if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
    return { valid: false, message: '지원하지 않는 오디오 형식입니다. (M4A, MP4, WAV 지원)' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: '파일이 너무 큽니다. (최대 50MB)' };
  }
  if (file.size === 0) {
    return { valid: false, message: '빈 파일입니다.' };
  }
  return { valid: true, message: '' };
}

export function validateRecordingDuration(durationSeconds: number): AudioValidationResult {
  if (durationSeconds < MIN_RECORDING_DURATION) {
    return { valid: false, message: `녹음이 너무 짧습니다. (최소 ${MIN_RECORDING_DURATION}초)` };
  }
  if (durationSeconds > MAX_RECORDING_DURATION) {
    return { valid: false, message: `녹음이 너무 깁니다. (최대 ${MAX_RECORDING_DURATION}초)` };
  }
  return { valid: true, message: '' };
}

// ============================================================================
// 이메일 검증
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function validateEmail(email: string): string | null {
  if (!email || !email.trim()) {
    return '이메일을 입력해주세요';
  }
  if (!isValidEmail(email)) {
    return '올바른 이메일 형식이 아닙니다';
  }
  return null;
}

// ============================================================================
// 비밀번호 검증
// ============================================================================

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 100;

export function validatePassword(password: string): string | null {
  if (!password) {
    return '비밀번호를 입력해주세요';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 최대 ${PASSWORD_MAX_LENGTH}자까지 가능합니다`;
  }
  return null;
}

export function validatePasswordConfirm(
  password: string,
  passwordConfirm: string
): string | null {
  if (!passwordConfirm) {
    return '비밀번호 확인을 입력해주세요';
  }
  if (password !== passwordConfirm) {
    return '비밀번호가 일치하지 않습니다';
  }
  return null;
}

// ============================================================================
// 이름 검증
// ============================================================================

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;

export function validateName(name: string): string | null {
  if (!name || !name.trim()) {
    return '이름을 입력해주세요';
  }
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN_LENGTH) {
    return `이름은 최소 ${NAME_MIN_LENGTH}자 이상이어야 합니다`;
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `이름은 최대 ${NAME_MAX_LENGTH}자까지 가능합니다`;
  }
  return null;
}

// ============================================================================
// 초대 코드 검증
// ============================================================================

export function isValidInviteCode(code: string): boolean {
  const trimmed = code.trim().toUpperCase();
  return (
    trimmed.length === APP_CONFIG.INVITE_CODE_LENGTH &&
    /^[A-Z0-9]+$/.test(trimmed)
  );
}

export function validateInviteCode(code: string): string | null {
  if (!code || !code.trim()) {
    return '초대 코드를 입력해주세요';
  }
  if (!isValidInviteCode(code)) {
    return `초대 코드는 ${APP_CONFIG.INVITE_CODE_LENGTH}자리 영문/숫자입니다`;
  }
  return null;
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

// ============================================================================
// 스크립트 검증
// ============================================================================

const SCRIPT_MIN_LENGTH = 10;
const SCRIPT_MAX_LENGTH = 5000;

export function validateScript(content: string): string | null {
  if (!content || !content.trim()) {
    return '스크립트 내용을 입력해주세요';
  }
  const trimmed = content.trim();
  if (trimmed.length < SCRIPT_MIN_LENGTH) {
    return `스크립트는 최소 ${SCRIPT_MIN_LENGTH}자 이상이어야 합니다`;
  }
  if (trimmed.length > SCRIPT_MAX_LENGTH) {
    return `스크립트는 최대 ${SCRIPT_MAX_LENGTH}자까지 가능합니다`;
  }
  return null;
}

// ============================================================================
// 피드백 검증
// ============================================================================

const FEEDBACK_MAX_LENGTH = 2000;

export function validateFeedback(feedback: string): string | null {
  if (!feedback || !feedback.trim()) {
    return '피드백 내용을 입력해주세요';
  }
  if (feedback.trim().length > FEEDBACK_MAX_LENGTH) {
    return `피드백은 최대 ${FEEDBACK_MAX_LENGTH}자까지 가능합니다`;
  }
  return null;
}

// ============================================================================
// 회원가입 폼 검증
// ============================================================================

export interface SignupFormData {
  email: string;
  password: string;
  passwordConfirm: string;
  name: string;
}

export interface SignupFormErrors {
  email?: string;
  password?: string;
  passwordConfirm?: string;
  name?: string;
}

export function validateSignupForm(data: SignupFormData): SignupFormErrors {
  const errors: SignupFormErrors = {};

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  const passwordError = validatePassword(data.password);
  if (passwordError) errors.password = passwordError;

  const passwordConfirmError = validatePasswordConfirm(
    data.password,
    data.passwordConfirm
  );
  if (passwordConfirmError) errors.passwordConfirm = passwordConfirmError;

  const nameError = validateName(data.name);
  if (nameError) errors.name = nameError;

  return errors;
}

export function isSignupFormValid(errors: SignupFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

// ============================================================================
// 로그인 폼 검증
// ============================================================================

export interface LoginFormData {
  email: string;
  password: string;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

export function validateLoginForm(data: LoginFormData): LoginFormErrors {
  const errors: LoginFormErrors = {};

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  if (!data.password) {
    errors.password = '비밀번호를 입력해주세요';
  }

  return errors;
}

export function isLoginFormValid(errors: LoginFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

// ============================================================================
// 점수 검증
// ============================================================================

export function isValidScore(score: number): boolean {
  return (
    typeof score === 'number' &&
    !isNaN(score) &&
    score >= APP_CONFIG.MIN_SCORE &&
    score <= APP_CONFIG.MAX_SCORE
  );
}

export function clampScore(score: number): number {
  return Math.max(
    APP_CONFIG.MIN_SCORE,
    Math.min(APP_CONFIG.MAX_SCORE, Math.round(score))
  );
}

// ============================================================================
// 재현율 검증
// ============================================================================

export function isValidReproductionRate(rate: number): boolean {
  return typeof rate === 'number' && !isNaN(rate) && rate >= 0 && rate <= 100;
}

export function clampReproductionRate(rate: number): number {
  return Math.max(0, Math.min(100, Math.round(rate * 10) / 10));
}
