import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { issueBillingKey, updateBillingKey } from '@/services/billing';
import { getUserMessage } from '@/lib/errors';
import { cleanPaymentUrlParams } from '@/lib/toss';
import { PAYMENT_CALLBACK } from '@/lib/constants';

// ============================================================================
// 결제 콜백 전용 라우트 (토스 표준 패턴)
//
// 토스 리다이렉트 → 이 페이지 → 마운트 1회 처리 → 결과 표시 → 이동
//
// 핵심 원칙:
// 1. URL 파라미터를 마운트 시 ref에 캡처 → 즉시 URL 정리
// 2. useEffect([], []) — 의존성 없음, 재실행 없음
// 3. auth 대기는 polling (useEffect 의존성 아님)
// 4. 에러 시 재시도는 캡처된 ref 사용 (URL 재파싱 아님)
// ============================================================================

type CallbackStatus = 'loading' | 'processing' | 'success' | 'error';

interface CapturedParams {
  action: string | null;
  authKey: string | null;
  customerKey: string | null;
  planKey: string | null;
  cycle: 'monthly' | 'yearly';
  status: string | null;
  message: string | null;
}

/** 웹 URL에서 파라미터 추출 (마운트 시 1회) */
function captureUrlParams(): CapturedParams {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { action: null, authKey: null, customerKey: null, planKey: null, cycle: 'monthly', status: null, message: null };
  }

  const url = new URL(window.location.href);
  return {
    action: url.searchParams.get('action'),
    authKey: url.searchParams.get('authKey'),
    customerKey: url.searchParams.get('customerKey'),
    planKey: url.searchParams.get('planKey'),
    cycle: url.searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly',
    status: url.searchParams.get('status'),
    message: url.searchParams.get('message'),
  };
}

export default function PaymentCallbackScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { isAuthenticated, _profileVerified, currentOrg } = useAuth();
  const { refresh: refreshSubscription } = useSubscription();

  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [statusMessage, setStatusMessage] = useState('결제 정보를 확인하고 있습니다...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 마운트 시 URL 파라미터 캡처 → 이후 URL 변경과 무관
  const paramsRef = useRef<CapturedParams | null>(null);
  const processedRef = useRef(false);

  // ── 마운트 1회 실행: 파라미터 캡처 → URL 정리 → 처리 시작 ──
  useEffect(() => {
    // 1. 파라미터 캡처 (마운트 시점의 URL)
    const captured = captureUrlParams();
    paramsRef.current = captured;

    // 2. URL 즉시 정리 (새로고침 시 재처리 방지)
    cleanPaymentUrlParams();

    // 3. 실패 콜백인 경우 즉시 에러 표시
    if (captured.status === PAYMENT_CALLBACK.STATUS.FAIL) {
      setStatus('error');
      setErrorMessage(captured.message || '결제가 취소되었습니다.');
      return;
    }

    // 4. 필수 파라미터 확인
    if (!captured.action || !captured.authKey) {
      setStatus('error');
      setErrorMessage('결제 정보를 찾을 수 없습니다. 다시 시도해 주세요.');
      return;
    }

    // 5. auth 대기 후 처리 시작
    waitForAuthAndProcess(captured);
  }, []); // 의존성 없음 — 마운트 1회만

  /** auth 초기화를 polling으로 대기 (최대 10초) */
  const waitForAuthAndProcess = async (params: CapturedParams) => {
    const maxWait = 10000;
    const interval = 300;
    let elapsed = 0;

    while (elapsed < maxWait) {
      // useAuth 상태는 ref로 접근 불가 → 직접 supabase 체크
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // auth 준비 완료 — orgId 대기
        await waitForOrgAndProcess(params);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
      elapsed += interval;
    }

    setStatus('error');
    setErrorMessage('인증 정보를 불러올 수 없습니다. 다시 로그인해 주세요.');
  };

  /** currentOrg 로드 대기 (최대 5초) — auth 완료 후 호출 */
  const waitForOrgAndProcess = async (params: CapturedParams) => {
    // update-billing은 orgId가 필요 → org 대기
    // new-subscription도 orgId 필요
    const maxWait = 5000;
    const interval = 300;
    let elapsed = 0;

    while (elapsed < maxWait) {
      // 직접 supabase에서 org 조회
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) break;

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .in('role', ['owner', 'teacher'])
        .is('deleted_at', null)
        .limit(1)
        .single();

      if (membership?.organization_id) {
        processCallback(params, membership.organization_id);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
      elapsed += interval;
    }

    setStatus('error');
    setErrorMessage('조직 정보를 불러올 수 없습니다. 다시 시도해 주세요.');
  };

  /** 실제 결제 콜백 처리 (1회만 실행) */
  const processCallback = async (params: CapturedParams, orgId: string) => {
    if (processedRef.current) return;
    processedRef.current = true;

    setStatus('processing');

    const { action, authKey, planKey, cycle } = params;

    try {
      if (action === PAYMENT_CALLBACK.ACTIONS.NEW_SUBSCRIPTION) {
        // ── 신규 구독: 빌링키 발급 + 첫 결제 ──
        if (!planKey) {
          setStatus('error');
          setErrorMessage('플랜 정보가 없습니다. 다시 시도해 주세요.');
          return;
        }

        setStatusMessage('결제를 처리하고 있습니다...');
        const { error } = await issueBillingKey(planKey, authKey!, orgId, cycle);

        if (error) {
          setStatus('error');
          setErrorMessage(getUserMessage(error));
          return;
        }

        await refreshSubscription();
        setStatus('success');
        setStatusMessage('구독이 완료되었습니다!');

      } else if (action === PAYMENT_CALLBACK.ACTIONS.UPDATE_BILLING) {
        // ── 결제 수단 변경 ──
        setStatusMessage('결제 수단을 변경하고 있습니다...');
        const { error } = await updateBillingKey(authKey!, orgId);

        if (error) {
          setStatus('error');
          setErrorMessage(getUserMessage(error));
          return;
        }

        await refreshSubscription();
        setStatus('success');
        setStatusMessage('결제 수단이 변경되었습니다!');

      } else {
        setStatus('error');
        setErrorMessage('알 수 없는 결제 요청입니다.');
      }
    } catch (err) {
      if (__DEV__) console.warn('[AppError] payment-callback:', err);
      setStatus('error');
      setErrorMessage(getUserMessage(err));
    }
  };

  /** 재시도 (캡처된 params 사용, URL 재파싱 아님) */
  const handleRetry = () => {
    if (!paramsRef.current?.authKey) {
      // authKey 없으면 재시도 불가 — 처음부터 다시
      navigateBack();
      return;
    }
    processedRef.current = false;
    setStatus('loading');
    setErrorMessage(null);
    waitForAuthAndProcess(paramsRef.current);
  };

  /** 이전 화면으로 이동 */
  const navigateBack = () => {
    const action = paramsRef.current?.action;
    if (action === PAYMENT_CALLBACK.ACTIONS.UPDATE_BILLING) {
      router.replace('/(teacher)/manage/subscription');
    } else {
      router.replace('/(teacher)/manage/plan-select');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* 로딩 / 처리 중 */}
      {(status === 'loading' || status === 'processing') && (
        <>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="card-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {status === 'loading' ? '결제 준비 중...' : '결제 처리 중...'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {statusMessage}
          </Text>
        </>
      )}

      {/* 성공 */}
      {status === 'success' && (
        <>
          <View style={[styles.iconCircle, { backgroundColor: colors.accentGreenBg }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {statusMessage}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            잠시 후 자동으로 이동합니다.
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={navigateBack}
          >
            <Text style={styles.buttonText}>확인</Text>
          </Pressable>
        </>
      )}

      {/* 에러 */}
      {status === 'error' && (
        <>
          <View style={[styles.iconCircle, { backgroundColor: colors.accentRedBg }]}>
            <Ionicons name="alert-circle" size={48} color={colors.error} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            결제 실패
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {errorMessage}
          </Text>
          <View style={styles.buttonGroup}>
            {paramsRef.current?.authKey && (
              <Pressable
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleRetry}
              >
                <Text style={styles.buttonText}>재시도</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={navigateBack}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>돌아가기</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonGroup: {
    gap: 10,
    width: '100%',
    maxWidth: 280,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    minWidth: 200,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
});
