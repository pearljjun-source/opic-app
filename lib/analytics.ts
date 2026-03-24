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
import { Mixpanel } from 'mixpanel-react-native';

// ============================================================================
// 초기화
// ============================================================================

const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? '';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

let mixpanel: Mixpanel | null = null;

export function initAnalytics(): void {
  if (!MIXPANEL_TOKEN || isSSR) return;

  try {
    mixpanel = new Mixpanel(MIXPANEL_TOKEN, false);
    mixpanel.init();
  } catch {
    if (__DEV__) console.warn('[Analytics] init failed');
  }
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
