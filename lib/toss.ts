import { Platform } from 'react-native';

// ============================================================================
// Toss Payments SDK 헬퍼 — 웹 전용 (빌링키 인증)
//
// 흐름:
// 1. requestTossBillingAuth() → Toss 카드 등록 페이지로 리다이렉트
// 2. 사용자가 카드 등록
// 3. Toss가 successUrl로 리다이렉트 (?authKey=xxx&customerKey=xxx)
// 4. 클라이언트가 authKey를 billing-key Edge Function에 전달
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

/** 결제 성공 URL 생성 (planKey를 쿼리 파라미터에 포함) */
export function buildPaymentUrls(planKey: string): { successUrl: string; failUrl: string } | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const base = window.location.origin;
  const path = '/(teacher)/manage/plan-select';

  return {
    successUrl: `${base}${path}?planKey=${encodeURIComponent(planKey)}`,
    failUrl: `${base}${path}?paymentStatus=fail`,
  };
}
