import { Platform } from 'react-native';

import { PAYMENT_CALLBACK } from '@/lib/constants';

// ============================================================================
// Toss Payments SDK 헬퍼 — 웹 전용 (빌링키 인증)
//
// 토스 표준 패턴:
// 1. requestTossBillingAuth() → Toss 카드 등록 페이지로 리다이렉트
// 2. 사용자가 카드 등록
// 3. Toss가 successUrl(전용 콜백 라우트)로 리다이렉트 (?authKey=xxx&customerKey=xxx)
// 4. 콜백 라우트에서 마운트 1회 처리 → 빌링키 발급 → 결과 표시
//
// 네이티브: expo-web-browser로 웹 결제 페이지 열기
// ============================================================================

const TOSS_CLIENT_KEY = process.env.EXPO_PUBLIC_TOSS_CLIENT_KEY || '';

/** Toss SDK 스크립트 동적 로드 (웹 전용) */
function loadTossScript(): Promise<(key: string) => { requestBillingAuth: (method: string, options: Record<string, string>) => void }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('window is not available'));
      return;
    }

    // 이미 로드됨
    if ((window as any).TossPayments) {
      resolve((window as any).TossPayments);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.onload = () => {
      if ((window as any).TossPayments) {
        resolve((window as any).TossPayments);
      } else {
        reject(new Error('TossPayments SDK 로드 실패'));
      }
    };
    script.onerror = () => reject(new Error('TossPayments SDK 스크립트 로드 실패'));
    document.head.appendChild(script);
  });
}

/**
 * 토스페이먼츠 빌링키 인증 요청 (웹 전용)
 *
 * 카드 등록 페이지로 리다이렉트됨.
 * 등록 후 successUrl로 ?authKey=xxx&customerKey=xxx 파라미터와 함께 리다이렉트.
 *
 * @throws {Error} 웹이 아닌 환경, 클라이언트 키 미설정, SDK 로드 실패 등
 */
export async function requestTossBillingAuth(params: {
  customerKey: string;
  successUrl: string;
  failUrl: string;
}): Promise<void> {
  if (Platform.OS !== 'web') {
    throw new Error('Toss SDK는 웹에서만 사용 가능합니다');
  }

  if (!TOSS_CLIENT_KEY) {
    throw new Error('결제 시스템이 설정되지 않았습니다');
  }

  const TossPayments = await loadTossScript();
  const tossPayments = TossPayments(TOSS_CLIENT_KEY);

  // requestBillingAuth는 리다이렉트 — 이 이후 코드는 실행 안 됨
  tossPayments.requestBillingAuth('카드', {
    customerKey: params.customerKey,
    successUrl: params.successUrl,
    failUrl: params.failUrl,
  });
}

/** Toss 클라이언트 키 설정 여부 확인 */
export function isTossConfigured(): boolean {
  return !!TOSS_CLIENT_KEY;
}

/**
 * 결제 콜백 URL 생성 (토스 표준 패턴)
 *
 * successUrl → 전용 콜백 라우트 (payment-callback)
 * failUrl → 전용 콜백 라우트 + status=fail
 */
export function buildPaymentUrls(params: {
  action: 'new-subscription' | 'update-billing';
  planKey?: string;
  cycle?: 'monthly' | 'yearly';
}): { successUrl: string; failUrl: string } | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const base = window.location.origin;
  const path = PAYMENT_CALLBACK.PATH;

  const successParams = new URLSearchParams();
  successParams.set('action', params.action);
  if (params.planKey) successParams.set('planKey', params.planKey);
  if (params.cycle && params.cycle !== 'monthly') successParams.set('cycle', params.cycle);

  const failParams = new URLSearchParams();
  failParams.set('status', PAYMENT_CALLBACK.STATUS.FAIL);
  failParams.set('action', params.action);

  return {
    successUrl: `${base}${path}?${successParams.toString()}`,
    failUrl: `${base}${path}?${failParams.toString()}`,
  };
}

/** URL 파라미터 즉시 정리 (콜백 처리 후 재실행 방지) */
export function cleanPaymentUrlParams(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.replaceState({}, '', window.location.pathname);
  }
}
