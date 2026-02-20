import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Link, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/components/layout/SafeAreaView';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormView } from '@/components/ui/FormView';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useTheme';
import { classifyAuthError } from '@/lib/errors';

export default function LoginScreen() {
  const { signIn, isLoading, isAuthenticated, _profileVerified } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 화면 포커스 시 비밀번호 초기화 (보안: SPA에서 컴포넌트가 메모리에 잔존할 수 있음)
  useFocusEffect(
    useCallback(() => {
      setPassword('');
      setError(null);
    }, [])
  );

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
        setError(classifyAuthError(signInError).userMessage);
      }
    } catch (err) {
      setError(classifyAuthError(err).userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // isLoading: 초기 로딩, isAuthenticated && !_profileVerified: 캐시 세션 검증 중
  if (isLoading || (isAuthenticated && !_profileVerified)) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>로딩 중...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
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
              backgroundColor: colors.accentPinkBg,
              paddingHorizontal: 24,
              paddingTop: 56,
              paddingBottom: 32,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              marginBottom: 32,
            }}>
              {Platform.OS === 'web' && (
                <Pressable
                  onPress={() => router.push('/')}
                  style={{ marginBottom: 16 }}
                >
                  <Image
                    source={require('@/assets/images/speaky-icon.png')}
                    style={{ width: 36, height: 36, borderRadius: 18 }}
                  />
                </Pressable>
              )}
              <Text style={{
                fontSize: 28,
                fontFamily: 'Pretendard-Bold',
                color: colors.primaryDark,
                letterSpacing: -0.5,
              }}>
                안녕하세요!
              </Text>
              <Text style={{
                fontSize: 28,
                fontFamily: 'Pretendard-Bold',
                color: colors.primary,
                letterSpacing: -0.5,
              }}>
                Speaky
              </Text>
              <Text style={{
                fontSize: 15,
                fontFamily: 'Pretendard-Regular',
                color: colors.textSecondary,
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
                backgroundColor: colors.accentRedBg,
                borderRadius: 16,
                padding: 14,
                marginBottom: 20,
              }}>
                <Text style={{ color: colors.error, fontSize: 14, fontFamily: 'Pretendard-Medium' }}>
                  {error}
                </Text>
              </View>
            )}

            {/* Form */}
            <FormView onSubmit={handleLogin} autoComplete="off" style={{ gap: 16 }}>
              <View>
                <Text style={{
                  fontSize: 15,
                  fontFamily: 'Pretendard-SemiBold',
                  color: colors.textPrimary,
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
                  autoComplete={Platform.OS === 'web' ? 'new-password' : 'email'}
                  leftIcon={
                    <Ionicons name="mail-outline" size={20} color={colors.textDisabled} />
                  }
                />
              </View>

              <View>
                <Text style={{
                  fontSize: 15,
                  fontFamily: 'Pretendard-SemiBold',
                  color: colors.textPrimary,
                  marginBottom: 8,
                }}>
                  비밀번호
                </Text>
                <Input
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                  autoComplete={Platform.OS === 'web' ? 'new-password' : 'password'}
                  leftIcon={
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textDisabled} />
                  }
                />
              </View>

              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity style={{ alignSelf: 'flex-end', paddingVertical: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
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
            </FormView>

            {/* Sign Up Link */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 32,
            }}>
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontFamily: 'Pretendard-Regular' }}>
                계정이 없으신가요?{' '}
              </Text>
              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity>
                  <Text style={{
                    color: colors.primary,
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
