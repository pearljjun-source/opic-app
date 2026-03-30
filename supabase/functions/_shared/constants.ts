// ============================================================================
// Edge Functions 공유 상수
// ============================================================================
// 2곳 이상 Edge Function에서 사용되는 외부 API URL을 중앙 관리합니다.
// 단일 사용 URL(Whisper STT, Expo Push, Resend 등)은 해당 함수에 인라인 유지.
// ============================================================================

/** TOSS Payments API — base URL. 엔드포인트는 각 함수에서 path를 붙여 사용 */
export const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

/** Claude (Anthropic) API */
export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
export const CLAUDE_API_VERSION = '2023-06-01';

/** OpenAI TTS API */
export const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
