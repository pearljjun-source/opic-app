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

export default function SignupScreen() {
  const { signUp, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return false;
    }
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return false;
    }
    if (!email.includes('@')) {
      setError('올바른 이메일 형식이 아닙니다.');
      return false;
    }
    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return false;
    }
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { error: signUpError, autoLoggedIn } = await signUp(
        email.trim(),
        password,
        name.trim(),
      );

      if (signUpError) {
        setError(classifyAuthError(signUpError).userMessage);
      } else if (autoLoggedIn) {
        // 이메일 인증 OFF → 세션 자동 생성 → onAuthStateChange가 홈으로 네비게이션
        // 별도 화면 표시 불필요
        return;
      } else {
        // 이메일 인증 ON → 인증 안내 화면 표시
        setSuccess(true);
      }
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">로딩 중...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (success) {
    return (
      <ScreenContainer backgroundColor={COLORS.GRAY_50}>
        <View className="flex-1 justify-center items-center px-6">
          <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
            <Ionicons name="checkmark-circle" size={48} color={COLORS.SUCCESS} />
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
            회원가입 완료!
          </Text>
          <Text className="text-base text-gray-500 text-center mb-8">
            이메일 인증 후 로그인해주세요.{'\n'}
            메일함을 확인해주세요.
          </Text>
          <Link href="/(auth)/login" asChild>
            <Button fullWidth size="lg">
              로그인하러 가기
            </Button>
          </Link>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={COLORS.GRAY_50}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 py-6">
            {/* Header */}
            <View className="flex-row items-center mb-6">
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity className="p-2 -ml-2">
                  <Ionicons name="arrow-back" size={24} color={COLORS.GRAY_900} />
                </TouchableOpacity>
              </Link>
              <Text className="text-2xl font-bold text-gray-900 ml-2">회원가입</Text>
            </View>

            {/* Form Card */}
            <View className="bg-white rounded-2xl p-6 shadow-sm">
              {error && (
                <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <Text className="text-red-600 text-sm">{error}</Text>
                </View>
              )}

              <Input
                label="이름"
                placeholder="홍길동"
                value={name}
                onChangeText={setName}
                autoComplete="name"
                leftIcon={
                  <Ionicons name="person-outline" size={20} color={COLORS.GRAY_400} />
                }
              />

              <Input
                label="이메일"
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

              <Input
                label="비밀번호"
                placeholder="6자 이상 입력하세요"
                value={password}
                onChangeText={setPassword}
                isPassword
                autoComplete="new-password"
                leftIcon={
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.GRAY_400} />
                }
              />

              <Input
                label="비밀번호 확인"
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                autoComplete="new-password"
                leftIcon={
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.GRAY_400} />
                }
              />

              <Button
                onPress={handleSignup}
                loading={isSubmitting}
                disabled={isSubmitting}
                fullWidth
                size="lg"
                className="mt-2"
              >
                회원가입
              </Button>
            </View>

            {/* Login Link */}
            <View className="flex-row justify-center items-center mt-6">
              <Text className="text-gray-500">이미 계정이 있으신가요? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text className="text-primary font-semibold">로그인</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
