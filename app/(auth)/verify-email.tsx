import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ScreenContainer } from '@/components/layout/SafeAreaView';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 180; // 3분

/**
 * 이메일 인증 코드 입력 화면
 *
 * 회원가입 후 이메일로 발송된 6자리 인증 코드를 입력하는 화면.
 * OTP 방식: 크로스 브라우저/모바일 호환 문제 없음.
 *
 * 보안:
 * - email은 URL param 대신 AsyncStorage에서 읽음 (URL 노출 방지)
 * - 5회 실패 시 3분 잠금 (브루트포스 방어 — 서버 rate limit과 이중 방어)
 */
export default function VerifyEmailScreen() {
  const colors = useThemeColors();

  const [email, setEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // AsyncStorage에서 email 읽기
  useEffect(() => {
    AsyncStorage.getItem('pending_verify_email').then(stored => {
      if (stored) setEmail(stored);
    });
  }, []);

  // 잠금 타이머
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handleOtpChange = (value: string, index: number) => {
    // 숫자만 허용
    const digit = value.replace(/[^0-9]/g, '');

    // 붙여넣기: 6자리 전체 입력
    if (digit.length > 1) {
      const digits = digit.slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError(null);

    // 다음 칸으로 자동 이동
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    // 백스페이스: 이전 칸으로 이동
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (lockoutRemaining > 0) return;

    const code = otp.join('');
    if (code.length !== 6) {
      setError('6자리 인증 코드를 모두 입력해주세요.');
      return;
    }

    if (!email) {
      setError('이메일 정보가 없습니다. 다시 회원가입해주세요.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (verifyError) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          setLockoutRemaining(LOCKOUT_SECONDS);
          setError(`인증 시도 횟수를 초과했습니다. ${Math.ceil(LOCKOUT_SECONDS / 60)}분 후 다시 시도해주세요.`);
        } else {
          setError(`인증 코드가 올바르지 않거나 만료되었습니다. (${newAttempts}/${MAX_ATTEMPTS})`);
        }
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        // 성공 — pending email 정리
        AsyncStorage.removeItem('pending_verify_email');
        // onAuthStateChange가 자동으로 홈으로 라우팅
      }
    } catch {
      setError('인증 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;

    try {
      const { error: resendError } = await supabase.auth.resend({
        email,
        type: 'signup',
      });

      if (resendError) {
        setError('코드 재발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      // 60초 쿨다운
      setResendCooldown(60);
      setError(null);
      setAttempts(0);
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError('코드 재발송 중 오류가 발생했습니다.');
    }
  };

  const isLocked = lockoutRemaining > 0;

  return (
    <ScreenContainer backgroundColor={colors.surfaceSecondary}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
            {/* Icon */}
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: colors.primaryLight,
                justifyContent: 'center', alignItems: 'center', marginBottom: 24,
              }}>
                <Ionicons name="mail-open-outline" size={40} color={colors.primary} />
              </View>

              <Text style={{
                fontSize: 22, fontFamily: 'Pretendard-Bold',
                color: colors.textPrimary, textAlign: 'center', marginBottom: 8,
              }}>
                이메일 인증
              </Text>

              <Text style={{
                fontSize: 15, fontFamily: 'Pretendard-Regular',
                color: colors.textSecondary, textAlign: 'center', lineHeight: 22,
              }}>
                {email ? `${email}로 발송된\n6자리 인증 코드를 입력해주세요.` : '이메일로 발송된 인증 코드를 입력해주세요.'}
              </Text>
            </View>

            {/* Error */}
            {error && (
              <View style={{
                backgroundColor: colors.accentRedBg,
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
              }}>
                <Text style={{ color: colors.error, fontSize: 14, fontFamily: 'Pretendard-Medium', textAlign: 'center' }}>
                  {error}
                </Text>
              </View>
            )}

            {/* Lockout */}
            {isLocked && (
              <View style={{
                backgroundColor: colors.accentRedBg,
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
              }}>
                <Text style={{ color: colors.error, fontSize: 14, fontFamily: 'Pretendard-Medium', textAlign: 'center' }}>
                  잠금 해제까지 {lockoutRemaining}초
                </Text>
              </View>
            )}

            {/* OTP Input */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 32,
              opacity: isLocked ? 0.5 : 1,
            }}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={ref => { inputRefs.current[index] = ref; }}
                  value={digit}
                  onChangeText={value => handleOtpChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={Platform.OS === 'web' ? 6 : 1}
                  editable={!isLocked}
                  style={{
                    width: 48, height: 56,
                    borderWidth: 2,
                    borderColor: digit ? colors.primary : colors.border,
                    borderRadius: 12,
                    fontSize: 24,
                    fontFamily: 'Pretendard-Bold',
                    color: colors.textPrimary,
                    textAlign: 'center',
                    backgroundColor: colors.surface,
                  }}
                  autoFocus={index === 0}
                />
              ))}
            </View>

            {/* Verify Button */}
            <Button
              onPress={handleVerify}
              loading={isSubmitting}
              disabled={isSubmitting || otp.join('').length !== 6 || isLocked}
              fullWidth
              size="lg"
            >
              인증하기
            </Button>

            {/* Resend */}
            <View style={{ alignItems: 'center', marginTop: 24 }}>
              {resendCooldown > 0 ? (
                <Text style={{
                  color: colors.textSecondary,
                  fontSize: 14, fontFamily: 'Pretendard-Regular',
                }}>
                  코드 재발송 ({resendCooldown}초)
                </Text>
              ) : (
                <Text
                  onPress={handleResend}
                  style={{
                    color: colors.primary,
                    fontSize: 14, fontFamily: 'Pretendard-SemiBold',
                  }}
                >
                  인증 코드 재발송
                </Text>
              )}
            </View>

            {/* Login Link */}
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <Link href="/(auth)/login">
                <Text style={{
                  color: colors.textSecondary,
                  fontSize: 14, fontFamily: 'Pretendard-Regular',
                }}>
                  로그인으로 돌아가기
                </Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
