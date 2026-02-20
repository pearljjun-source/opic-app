import { useState, useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/components/layout/SafeAreaView';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

/**
 * 이메일 인증 콜백 페이지
 *
 * Supabase 이메일 확인/비밀번호 재설정 링크 클릭 시 리다이렉트되는 페이지.
 * URL 형태: /confirm?code=xxx (PKCE flow)
 *
 * 처리 흐름:
 * 1. URL에서 code 파라미터 추출
 * 2. supabase.auth.exchangeCodeForSession(code) 호출
 * 3. 성공 → 세션 생성 → useAuth의 onAuthStateChange가 홈으로 라우팅
 * 4. 실패 → 에러 메시지 표시 + 로그인 링크
 */
export default function AuthConfirmScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    handleConfirm();
  }, []);

  const handleConfirm = async () => {
    // 웹: URL hash에서 토큰 추출 시도 (implicit flow 대비)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
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

    // PKCE flow: code 파라미터로 세션 교환
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

    // URL에 에러 파라미터가 있는 경우
    if (params.error) {
      setStatus('error');
      setErrorMessage(params.error_description || '인증 처리 중 오류가 발생했습니다.');
      return;
    }

    // code도 token도 없으면 에러
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
              이메일 인증 완료!
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
