import { useState, useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/components/layout/SafeAreaView';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

/**
 * 비밀번호 재설정 콜백 페이지
 *
 * Supabase 비밀번호 재설정 링크 클릭 시 리다이렉트되는 페이지.
 * (이메일 인증은 OTP 방식으로 verify-email.tsx에서 처리)
 *
 * Implicit flow:
 *   URL: /confirm#access_token=xxx&refresh_token=xxx
 *   → detectSessionInUrl이 자동 처리하거나, 수동으로 setSession 호출
 *
 * 보안:
 * - 토큰 처리 후 URL hash 즉시 제거 (브라우저 히스토리 노출 방지)
 * - error_description 등 URL 파라미터를 직접 렌더링하지 않음 (피싱 방지)
 * - getUser()로 서버 검증 (getSession()은 로컬 캐시만 확인)
 */
export default function AuthConfirmScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    handleConfirm();
  }, []);

  /** URL hash를 즉시 제거 — 토큰이 브라우저 히스토리에 남지 않도록 */
  const clearUrlHash = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleConfirm = async () => {
    // 1. detectSessionInUrl이 이미 처리한 경우 — 서버 검증
    const { data: { user: existingUser } } = await supabase.auth.getUser();
    if (existingUser) {
      clearUrlHash();
      setStatus('success');
      return;
    }

    // 2. 웹: URL hash에서 토큰 추출 (implicit flow)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          // 토큰 추출 즉시 URL hash 제거
          clearUrlHash();

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setStatus('error');
            setErrorMessage('인증 처리 중 오류가 발생했습니다.');
            return;
          }

          setStatus('success');
          return;
        }
      }
    }

    // 3. PKCE fallback: code 파라미터로 세션 교환
    const code = params.code;
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setStatus('error');
        setErrorMessage('인증 링크가 만료되었거나 이미 사용되었습니다.');
        return;
      }

      setStatus('success');
      return;
    }

    // 4. URL에 에러 파라미터가 있는 경우 — 고정 메시지만 사용 (피싱 방지)
    if (params.error) {
      setStatus('error');
      setErrorMessage('인증 처리 중 오류가 발생했습니다.');
      return;
    }

    // 5. detectSessionInUrl 비동기 처리 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    const { data: { user: retryUser } } = await supabase.auth.getUser();
    if (retryUser) {
      clearUrlHash();
      setStatus('success');
      return;
    }

    // 6. 최종 에러
    setStatus('error');
    setErrorMessage('유효하지 않은 인증 링크입니다.');
  };

  return (
    <ScreenContainer backgroundColor={colors.surfaceSecondary}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        {status === 'loading' && (
          <>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: colors.primaryLight,
              justifyContent: 'center', alignItems: 'center', marginBottom: 24,
            }}>
              <Ionicons name="shield-checkmark-outline" size={40} color={colors.primary} />
            </View>
            <Text style={{
              fontSize: 20, fontFamily: 'Pretendard-Bold',
              color: colors.textPrimary, marginBottom: 8, textAlign: 'center',
            }}>
              인증 처리 중...
            </Text>
            <Text style={{
              fontSize: 15, fontFamily: 'Pretendard-Regular',
              color: colors.textSecondary, textAlign: 'center',
            }}>
              잠시만 기다려주세요.
            </Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: '#DCFCE7',
              justifyContent: 'center', alignItems: 'center', marginBottom: 24,
            }}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            </View>
            <Text style={{
              fontSize: 20, fontFamily: 'Pretendard-Bold',
              color: colors.textPrimary, marginBottom: 8, textAlign: 'center',
            }}>
              인증 완료!
            </Text>
            <Text style={{
              fontSize: 15, fontFamily: 'Pretendard-Regular',
              color: colors.textSecondary, textAlign: 'center', marginBottom: 32,
            }}>
              잠시 후 자동으로 이동합니다.
            </Text>
          </>
        )}

        {status === 'error' && (
          <>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: colors.accentRedBg,
              justifyContent: 'center', alignItems: 'center', marginBottom: 24,
            }}>
              <Ionicons name="alert-circle" size={48} color={colors.error} />
            </View>
            <Text style={{
              fontSize: 20, fontFamily: 'Pretendard-Bold',
              color: colors.textPrimary, marginBottom: 8, textAlign: 'center',
            }}>
              인증 실패
            </Text>
            <Text style={{
              fontSize: 15, fontFamily: 'Pretendard-Regular',
              color: colors.textSecondary, textAlign: 'center', marginBottom: 32,
            }}>
              {errorMessage}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Button fullWidth size="lg">로그인으로 이동</Button>
            </Link>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
