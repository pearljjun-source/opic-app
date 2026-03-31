// ============================================================================
// Edge Functions 공유 상수
// ============================================================================
// 2곳 이상 Edge Function에서 사용되는 외부 API URL/설정을 중앙 관리합니다.
// 단일 사용 URL(Whisper STT, Expo Push, Resend 등)은 해당 함수에 인라인 유지.
// ============================================================================

/** TOSS Payments API — base URL. 엔드포인트는 각 함수에서 path를 붙여 사용 */
export const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

/** Claude (Anthropic) API */
export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
export const CLAUDE_API_VERSION = '2023-06-01';

/** OpenAI TTS API */
export const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

// ============================================================================
// API Rate Limit 설정 (Single Source of Truth)
// ============================================================================
// 이 값들은 check_api_rate_limit RPC에 파라미터로 전달됩니다.
// 변경 시 이 파일만 수정하면 됩니다.
// ⚠️ 클라이언트 lib/constants.ts의 APP_CONFIG.API_RATE_LIMIT도 동기화 필요 (표시용)
// ============================================================================

export const RATE_LIMITS = {
  /** Whisper STT: 시간당 최대 호출 수 */
  WHISPER: { maxRequests: 30, windowMinutes: 60 },
  /** Claude AI (feedback, translation, exam-evaluate): 시간당 최대 호출 수 */
  CLAUDE: { maxRequests: 30, windowMinutes: 60 },
  /** OpenAI TTS: 시간당 최대 호출 수 */
  TTS: { maxRequests: 50, windowMinutes: 60 },
} as const;
