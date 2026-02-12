// ============================================================================
// OPIc 학습 앱 - 유틸리티 헬퍼 함수
// ============================================================================

import { APP_CONFIG } from './constants';
import type { TimerId } from './types';

// ============================================================================
// 날짜/시간 포맷팅
// ============================================================================

/**
 * ISO 날짜 문자열을 한국어 날짜 형식으로 변환
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * ISO 날짜 문자열을 한국어 날짜시간 형식으로 변환
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * ISO 날짜 문자열을 짧은 형식으로 변환 (MM/DD)
 */
export function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 상대 시간 표시 (방금 전, N분 전 등)
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffWeek < 4) return `${diffWeek}주 전`;
  if (diffMonth < 12) return `${diffMonth}개월 전`;
  return `${diffYear}년 전`;
}

/**
 * 초를 MM:SS 형식으로 변환
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 밀리초를 MM:SS 형식으로 변환
 */
export function formatDurationMs(ms: number): string {
  return formatDuration(Math.floor(ms / 1000));
}

// ============================================================================
// 초대 코드 생성
// ============================================================================

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // I, O, 0, 1 제외 (혼동 방지)

/**
 * 랜덤 초대 코드 생성
 */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < APP_CONFIG.INVITE_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * INVITE_CODE_CHARS.length);
    code += INVITE_CODE_CHARS[randomIndex];
  }
  return code;
}

// ============================================================================
// 점수/재현율 포맷팅
// ============================================================================

/**
 * 점수를 퍼센트 문자열로 변환
 */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '-';
  return `${Math.round(score)}점`;
}

/**
 * 재현율을 퍼센트 문자열로 변환
 */
export function formatReproductionRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '-';
  return `${Math.round(rate)}%`;
}

/**
 * 점수에 따른 등급 색상 반환
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return '#10B981'; // green
  if (score >= 70) return '#3B82F6'; // blue
  if (score >= 50) return '#F59E0B'; // yellow
  return '#EF4444'; // red
}

/**
 * 점수에 따른 등급 텍스트 반환
 */
export function getScoreGrade(score: number): string {
  if (score >= 90) return '우수';
  if (score >= 70) return '양호';
  if (score >= 50) return '보통';
  return '노력 필요';
}

// ============================================================================
// 문자열 유틸리티
// ============================================================================

/**
 * 문자열 자르기 (말줄임표 포함)
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * 이름 마스킹 (예: 홍길동 -> 홍*동)
 */
export function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

/**
 * 이메일 마스킹 (예: test@example.com -> te**@example.com)
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  if (localPart.length <= 2) return localPart + '@' + domain;
  return localPart.slice(0, 2) + '**@' + domain;
}

// ============================================================================
// 배열/객체 유틸리티
// ============================================================================

/**
 * 배열을 특정 키로 그룹핑
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    },
    {} as Record<string, T[]>
  );
}

/**
 * 배열에서 중복 제거
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * 배열에서 특정 키 기준 중복 제거
 */
export function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

// ============================================================================
// 지연 실행
// ============================================================================

/**
 * 지정된 시간(ms) 동안 대기
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 디바운스 함수
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: TimerId | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * 스로틀 함수
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// ============================================================================
// 에러 핸들링
// ============================================================================

/**
 * Supabase 에러 메시지 추출
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return '알 수 없는 오류가 발생했습니다';

  if (typeof error === 'string') return error;

  if (error instanceof Error) return error.message;

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (
      typeof obj.error === 'object' &&
      obj.error !== null &&
      typeof (obj.error as Record<string, unknown>).message === 'string'
    ) {
      return (obj.error as Record<string, unknown>).message as string;
    }
  }

  return '알 수 없는 오류가 발생했습니다';
}

/**
 * 네트워크 에러 여부 확인
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('timeout')
  );
}

// ============================================================================
// UUID
// ============================================================================

/**
 * 간단한 UUID v4 생성 (crypto 사용 불가능한 환경용)
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
