/**
 * Analytics 서비스 (Mixpanel)
 *
 * 핵심 퍼널 트래킹:
 * - 가입 → 첫 연습
 * - 기능별 사용률
 * - 구독 이벤트
 *
 * 모든 호출은 try-catch로 감싸여 있어 앱 크래시 방지.
 * EXPO_PUBLIC_MIXPANEL_TOKEN이 없으면 모든 호출이 no-op.
 */

import { Platform } from 'react-native';
// ⚠️ 값이 아니라 **타입만** 가져온다. 값으로 가져오면 이 파일을 읽는 순간
//    mixpanel-react-native 가 실행되고, 그 안의 uuid 가 브라우저 crypto 를 찾다가
//    Node 프리렌더에서 터진다. 실제 구현은 initAnalytics 안에서 동적으로 가져온다.
import type { Mixpanel } from 'mixpanel-react-native';

// ============================================================================
// 초기화
// ============================================================================

const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? '';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

let mixpanel: Mixpanel | null = null;

/**
 * Mixpanel 초기화.
 *
 * ⚠️ **정적 import 로 되돌리지 말 것.**
 *
 * 원래는 파일 최상단에서 `import { Mixpanel } from 'mixpanel-react-native'` 를
 * 하고, 아래 isSSR 가드로 SSR 을 피했다고 여겼다. 그런데 가드는 "함수를 부르는
 * 것" 을 막을 뿐이고, 터지는 곳은 "모듈을 불러오는 것" 이다. import 는 이 파일을
 * 읽는 순간 이미 실행된다.
 *
 * 그래서 웹 정적 빌드(output: 'static')가 통째로 실패했다 — 모든 화면의
 * 프리렌더가 mixpanel 의 uuid 에서 죽어 HTML 이 한 장도 만들어지지 않았다.
 * 에러 메시지는 없어 보였지만(가드가 있으니) 원인은 그대로 있었던 셈이다.
 *
 * 동적 import 는 이 함수가 실제로 실행될 때만 모듈을 가져온다. 프리렌더에서는
 * isSSR 에서 먼저 돌아서므로 아예 불러오지 않는다.
 */
export function initAnalytics(): void {
  if (!MIXPANEL_TOKEN || isSSR) return;

  void import('mixpanel-react-native')
    .then(({ Mixpanel: MixpanelClass }) => {
      const client = new MixpanelClass(MIXPANEL_TOKEN, false);
      client.init();
      mixpanel = client;
    })
    .catch(() => {
      // 분석이 안 되는 것은 앱이 죽는 것보다 낫다. 조용히 넘긴다.
      if (__DEV__) console.warn('[Analytics] init failed');
    });
}

// ============================================================================
// Core API
// ============================================================================

export function identify(userId: string): void {
  try {
    mixpanel?.identify(userId);
  } catch {
    // no-op
  }
}

export function setUserProperties(props: Record<string, unknown>): void {
  try {
    if (!mixpanel) return;
    const people = mixpanel.getPeople();
    for (const [key, value] of Object.entries(props)) {
      people.set(key, value as string);
    }
  } catch {
    // no-op
  }
}

export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    mixpanel?.track(event, properties);
  } catch {
    // no-op
  }
}

export function resetAnalytics(): void {
  try {
    mixpanel?.reset();
  } catch {
    // no-op
  }
}

// ============================================================================
// 이벤트 상수
// ============================================================================

export const EVENTS = {
  // Auth
  SIGNUP_COMPLETED: 'Signup Completed',
  LOGIN: 'Login',

  // Core funnel
  PRACTICE_STARTED: 'Practice Started',
  PRACTICE_COMPLETED: 'Practice Completed',

  // Feature usage
  SCRIPT_CREATED: 'Script Created',
  EXAM_STARTED: 'Exam Started',
  EXAM_COMPLETED: 'Exam Completed',
  INVITE_CREATED: 'Invite Created',
  TRANSLATION_PRACTICE: 'Translation Practice Started',
  AI_FEEDBACK_VIEWED: 'AI Feedback Viewed',

  // Screen
  SCREEN_VIEW: 'Screen View',

  // Subscription
  SUBSCRIPTION_STARTED: 'Subscription Started',
  SUBSCRIPTION_CANCELED: 'Subscription Canceled',
  PLAN_CHANGED: 'Plan Changed',
} as const;
