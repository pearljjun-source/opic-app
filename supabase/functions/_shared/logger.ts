// _shared/logger.ts
// Edge Function 공통: 환경 기반 조건부 로깅
//
// 프로덕션: 에러 타입만 로깅 (민감 정보 제외)
// 개발: 전체 에러 상세 로깅

// 프로덕션 판별: DENO_ENV='development'가 명시적으로 설정된 경우만 개발 모드
// Supabase Edge Functions에서 DENO_ENV는 자동 설정되지 않으므로
// 미설정 시 프로덕션으로 간주 (안전 방향)
const isDevelopment = Deno.env.get('DENO_ENV') === 'development';
const isProduction = !isDevelopment;

export const logger = {
  /** 프로덕션에서는 메시지만, 개발에서는 상세 정보 포함 */
  error(message: string, detail?: unknown) {
    if (isProduction) {
      console.error(`[ERROR] ${message}`);
    } else {
      console.error(`[ERROR] ${message}`, detail ?? '');
    }
  },

  /** 개발 환경에서만 출력 */
  warn(message: string, detail?: unknown) {
    if (!isProduction) {
      console.warn(`[WARN] ${message}`, detail ?? '');
    }
  },

  /** 개발 환경에서만 출력 */
  info(message: string, detail?: unknown) {
    if (!isProduction) {
      console.log(`[INFO] ${message}`, detail ?? '');
    }
  },
};
