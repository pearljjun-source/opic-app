// ============================================================================
// Sentry 초기화 및 설정
// ============================================================================
// 프로덕션 환경에서 크래시/에러 모니터링을 위한 Sentry 설정
// DSN은 환경변수 EXPO_PUBLIC_SENTRY_DSN으로 관리
// ============================================================================

import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export function initSentry() {
  if (!SENTRY_DSN) {
    if (__DEV__) console.warn('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    // 프로덕션에서만 에러 캡처
    beforeSend(event) {
      // 민감 정보 필터링
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['authorization'];
      }
      return event;
    },
    // 사용자 정보 최소화
    beforeSendTransaction(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

/** Sentry에 사용자 ID 설정 (로그인 시 호출) */
export function setSentryUser(userId: string) {
  Sentry.setUser({ id: userId });
}

/** Sentry 사용자 초기화 (로그아웃 시 호출) */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/** 수동 에러 캡처 (서비스 레이어에서 사용) */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export { Sentry };
