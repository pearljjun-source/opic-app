// ============================================================================
// OPIc 학습 앱 - 유틸리티 헬퍼 함수
// ============================================================================

import { APP_CONFIG, OPIC_SCORE_THRESHOLDS, OPIC_GRADES, ATTENTION_THRESHOLDS, COLORS } from './constants';
import type {
  TimerId,
  OpicGrade,
  OpicLevelEstimate,
  TrendDirection,
  TeacherStudentListItem,
  TeacherDashboardStats,
  AttentionItem,
} from './types';

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
// OPIc 등급 추정
// ============================================================================

/**
 * 평균 점수로 OPIc 등급 추정
 * OPIC_SCORE_THRESHOLDS 기준으로 매핑 (내림차순 정렬된 배열)
 */
export function estimateOpicLevel(avgScore: number | null): OpicLevelEstimate {
  if (avgScore === null || avgScore === undefined) {
    return { grade: 'NL', label: '측정 중' };
  }
  for (const threshold of OPIC_SCORE_THRESHOLDS) {
    if (avgScore >= threshold.minScore) {
      return { grade: threshold.grade, label: threshold.grade };
    }
  }
  return { grade: 'NL', label: 'NL' };
}

/**
 * OPIc 등급의 숫자 인덱스 반환 (NL=0, NM=1, ..., AL=8)
 * 진행률 계산에 사용
 */
export function getOpicGradeIndex(grade: OpicGrade): number {
  const index = OPIC_GRADES.indexOf(grade);
  return index >= 0 ? index : 0;
}

/**
 * 현재 등급에서 목표 등급까지의 진행률 (0~100)
 * 예: 현재 IM2(5), 목표 IH(7) → (5/7) * 100 = 71%
 */
export function getOpicGradeProgress(
  currentGrade: OpicGrade,
  targetGrade: OpicGrade | null
): number {
  if (!targetGrade) return 0;
  const currentIndex = getOpicGradeIndex(currentGrade);
  const targetIndex = getOpicGradeIndex(targetGrade);
  if (targetIndex <= 0) return 0;
  if (currentIndex >= targetIndex) return 100;
  return Math.round((currentIndex / targetIndex) * 100);
}

/**
 * OPIc 등급별 색상 반환
 */
export function getOpicGradeColor(grade: OpicGrade): string {
  const index = getOpicGradeIndex(grade);
  if (index >= 7) return COLORS.SUCCESS;     // IH, AL
  if (index >= 4) return COLORS.PRIMARY;     // IM1, IM2, IM3
  if (index >= 3) return COLORS.SECONDARY;   // IL
  return COLORS.GRAY_400;                    // NL, NM, NH
}

// ============================================================================
// 트렌드 비교
// ============================================================================

/**
 * 현재 값과 이전 값을 비교해서 트렌드 방향 반환
 * prev가 null이면 비교 불가 → null 반환
 */
export function getTrendDirection(
  current: number | null,
  prev: number | null
): TrendDirection {
  if (current === null || prev === null) return null;
  if (current > prev) return 'up';
  if (current < prev) return 'down';
  return 'same';
}

// ============================================================================
// 강사 대시보드 집계
// ============================================================================

/**
 * 학생 목록에서 대시보드 요약 통계 계산 (클라이언트 사이드)
 */
export function computeTeacherDashboardStats(
  students: TeacherStudentListItem[]
): TeacherDashboardStats {
  if (students.length === 0) {
    return {
      totalStudents: 0,
      thisWeekPractices: 0,
      pendingFeedbacks: 0,
      avgScore: null,
    };
  }

  const thisWeekPractices = students.reduce(
    (sum, s) => sum + (s.this_week_practices ?? 0), 0
  );

  const pendingFeedbacks = students.reduce(
    (sum, s) => sum + (s.pending_feedback_count ?? 0), 0
  );

  // 점수가 있는 학생만 평균 계산
  const studentsWithScore = students.filter(
    (s) => s.avg_score !== null && s.avg_score !== undefined
  );
  const avgScore = studentsWithScore.length > 0
    ? Math.round(
        (studentsWithScore.reduce((sum, s) => sum + (s.avg_score as number), 0)
          / studentsWithScore.length) * 10
      ) / 10
    : null;

  return {
    totalStudents: students.length,
    thisWeekPractices,
    pendingFeedbacks,
    avgScore,
  };
}

/**
 * 관심 필요 학생 필터링 (클라이언트 사이드 규칙 기반)
 *
 * 규칙:
 * 1. 14일+ 미연습 → danger (빨간색)
 * 2. 7일+ 미연습 → warning (노란색)
 * 3. 스크립트 배정 후 연습 0회 → warning
 */
export function computeAttentionItems(
  students: TeacherStudentListItem[]
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = new Date();

  for (const student of students) {
    // 규칙 1, 2: 미연습 일수
    if (student.last_practice_at) {
      const lastPractice = new Date(student.last_practice_at);
      const daysSince = Math.floor(
        (now.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSince >= ATTENTION_THRESHOLDS.DANGER_INACTIVE_DAYS) {
        items.push({
          student,
          type: 'inactive',
          level: 'danger',
          message: `${daysSince}일째 미연습`,
        });
        continue; // 한 학생에 대해 가장 심각한 알림만
      }

      if (daysSince >= ATTENTION_THRESHOLDS.WARNING_INACTIVE_DAYS) {
        items.push({
          student,
          type: 'inactive',
          level: 'warning',
          message: `${daysSince}일째 미연습`,
        });
        continue;
      }
    } else if (student.scripts_count > 0) {
      // last_practice_at이 null이고 스크립트가 있는 경우 → 한 번도 연습 안 함
      items.push({
        student,
        type: 'no_practice',
        level: 'warning',
        message: '스크립트 배정 후 연습 없음',
      });
      continue;
    }

    // 규칙 3: 스크립트 있는데 연습 0회 (last_practice_at이 있어도 practices_count가 0인 경우는 논리적 불가)
    if (student.scripts_count > 0 && student.practices_count === 0 && student.last_practice_at) {
      items.push({
        student,
        type: 'no_practice',
        level: 'warning',
        message: '스크립트 배정 후 연습 없음',
      });
    }
  }

  // danger 먼저, 같은 레벨이면 이름순
  items.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'danger' ? -1 : 1;
    return (a.student.name ?? '').localeCompare(b.student.name ?? '');
  });

  return items;
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
