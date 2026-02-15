import { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/components/layout/SafeAreaView';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { classifyAuthError } from '@/lib/errors';

export default function LoginScreen() {
  const { signIn, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }
    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        // TODO: 디버그용 — 실제 에러 메시지 표시 (원인 파악 후 제거)
        const raw = signInError.message || String(signInError);
        const classified = classifyAuthError(signInError);
        setError(`[${classified.code}] ${raw}`);
      }
    } catch (err) {
      setError(`[catch] ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 16 }}>로딩 중...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={COLORS.WHITE}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1 }}>
            {/* Header — 크림 배경 */}
            <View style={{
              backgroundColor: '#FFF0F2',
              paddingHorizontal: 24,
              paddingTop: 56,
              paddingBottom: 32,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              marginBottom: 32,
            }}>
              <Text style={{
                fontSize: 28,
                fontFamily: 'Pretendard-Bold',
                color: COLORS.PRIMARY_DARK,
                letterSpacing: -0.5,
              }}>
                안녕하세요!
              </Text>
              <Text style={{
                fontSize: 28,
                fontFamily: 'Pretendard-Bold',
                color: COLORS.PRIMARY,
                letterSpacing: -0.5,
              }}>
                Speaky
              </Text>
              <Text style={{
                fontSize: 15,
                fontFamily: 'Pretendard-Regular',
                color: COLORS.TEXT_SECONDARY,
                marginTop: 8,
                lineHeight: 22,
              }}>
                스크립트 기반 영어 말하기 연습
              </Text>
            </View>

            <View style={{ paddingHorizontal: 24 }}>

            {/* Error */}
            {error && (
              <View style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 16,
                padding: 14,
                marginBottom: 20,
              }}>
                <Text style={{ color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium' }}>
                  {error}
                </Text>
              </View>
            )}

            {/* Form */}
            <View style={{ gap: 16 }}>
              <View>
                <Text style={{
                  fontSize: 15,
                  fontFamily: 'Pretendard-SemiBold',
                  color: COLORS.TEXT_PRIMARY,
                  marginBottom: 8,
                }}>
                  이메일
                </Text>
                <Input
                  placeholder="example@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  leftIcon={
                    <Ionicons name="mail-outline" size={20} color={COLORS.GRAY_400} />
                  }
                />
              </View>

              <View>
                <Text style={{
                  fontSize: 15,
                  fontFamily: 'Pretendard-SemiBold',
                  color: COLORS.TEXT_PRIMARY,
                  marginBottom: 8,
                }}>
                  비밀번호
                </Text>
                <Input
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                  autoComplete="password"
                  leftIcon={
                    <Ionicons name="lock-closed-outline" size={20} color={COLORS.GRAY_400} />
                  }
                />
              </View>

              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity style={{ alignSelf: 'flex-end', paddingVertical: 4 }}>
                  <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14 }}>
                    비밀번호를 잊으셨나요?
                  </Text>
                </TouchableOpacity>
              </Link>

              <Button
                onPress={handleLogin}
                loading={isSubmitting}
                disabled={isSubmitting}
                fullWidth
                size="lg"
              >
                로그인
              </Button>
            </View>

            {/* Sign Up Link */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 32,
            }}>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 15, fontFamily: 'Pretendard-Regular' }}>
                계정이 없으신가요?{' '}
              </Text>
              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity>
                  <Text style={{
                    color: COLORS.PRIMARY,
                    fontFamily: 'Pretendard-Bold',
                    fontSize: 15,
                  }}>
                    회원가입
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
