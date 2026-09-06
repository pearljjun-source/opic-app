// ============================================================================
// E2E / 컴포넌트 테스트용 식별자
//
// ⚠️ 화면 문구로 요소를 찾으면 안 된다. "실전 연습" 을 "연습하기" 로 바꾸는 순간
//    E2E 가 깨지고, 문구는 자주 바뀐다. 그런 테스트는 금방 신뢰를 잃고 방치된다.
//    여기 정의한 값은 **화면에 보이지 않는 계약** 이므로 문구와 무관하게 유지된다.
//
// ⚠️ 값을 바꾸면 .maestro/ 의 플로우도 함께 고쳐야 한다.
//
// 범위: E2E 핵심 플로우(로그인 → 토픽 → 스크립트 → 녹음 → 결과 → 삭제)에
//       필요한 것만 둔다. 화면의 모든 요소에 붙이지 않는다.
// ============================================================================

export const TEST_IDS = {
  // 로그인
  LOGIN_EMAIL: 'login-email',
  LOGIN_PASSWORD: 'login-password',
  LOGIN_SUBMIT: 'login-submit',

  // 학생 홈
  TOPIC_CARD: 'topic-card',

  // 토픽 상세 — 스크립트가 있는 질문만 연습으로 이어진다
  QUESTION_CARD_WITH_SCRIPT: 'question-card-with-script',

  // 스크립트 상세
  SCRIPT_PRACTICE_BUTTON: 'script-practice-button',

  // 연습 화면
  PRACTICE_RECORD_BUTTON: 'practice-record-button',
  PRACTICE_STOP_BUTTON: 'practice-stop-button',

  // 연습 결과
  PRACTICE_RESULT_SCORE: 'practice-result-score',

  // 연습 기록 (정리용)
  HISTORY_CARD: 'history-card',
  HISTORY_DELETE_BUTTON: 'history-delete-button',
} as const;
