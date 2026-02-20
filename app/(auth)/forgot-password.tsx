import { useState } from 'react';
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
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/components/layout/SafeAreaView';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormView } from '@/components/ui/FormView';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useTheme';
import { classifyAuthError } from '@/lib/errors';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }
    if (!email.includes('@')) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const { error: resetError } = await resetPassword(email.trim());
      if (resetError) {
        setError(classifyAuthError(resetError).userMessage);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('비밀번호 재설정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <ScreenContainer backgroundColor={colors.surfaceSecondary}>
        <View className="flex-1 justify-center items-center px-6">
          <View className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-6">
            <Ionicons name="mail" size={40} color={colors.primary} />
          </View>
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2 text-center">
            이메일을 확인해주세요
          </Text>
          <Text className="text-base text-gray-500 dark:text-gray-400 text-center mb-8">
            {email}로{'\n'}
            비밀번호 재설정 링크를 보냈습니다.
          </Text>
          <Link href="/(auth)/login" asChild>
            <Button fullWidth size="lg">
              로그인으로 돌아가기
            </Button>
          </Link>
          <TouchableOpacity
            className="mt-4 py-2"
            onPress={() => {
              setSuccess(false);
              setEmail('');
            }}
          >
            <Text className="text-primary text-sm">다른 이메일로 시도하기</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={colors.surfaceSecondary}>
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
              {Platform.OS === 'web' ? (
                <Pressable onPress={() => router.push('/')} style={{ marginRight: 8 }}>
                  <Image
                    source={require('@/assets/images/speaky-icon.png')}
                    style={{ width: 36, height: 36, borderRadius: 18 }}
                  />
                </Pressable>
              ) : (
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity className="p-2 -ml-2">
                    <Ionicons name="arrow-back" size={24} color={colors.gray900} />
                  </TouchableOpacity>
                </Link>
              )}
              <Text className="text-2xl font-bold text-gray-900 dark:text-gray-50 ml-2">
                비밀번호 찾기
              </Text>
            </View>

            {/* Form Card */}
            <FormView onSubmit={handleResetPassword} style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 24,
            }}>
              <View className="items-center mb-6">
                <View className="w-16 h-16 bg-gray-100 dark:bg-neutral-800 rounded-full items-center justify-center mb-4">
                  <Ionicons name="key-outline" size={32} color={colors.gray500} />
                </View>
                <Text className="text-base text-gray-600 dark:text-gray-400 text-center">
                  가입할 때 사용한 이메일을 입력하시면{'\n'}
                  비밀번호 재설정 링크를 보내드립니다.
                </Text>
              </View>

              {error && (
                <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <Text className="text-red-600 text-sm">{error}</Text>
                </View>
              )}

              <Input
                label="이메일"
                placeholder="example@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon={
                  <Ionicons name="mail-outline" size={20} color={colors.textDisabled} />
                }
              />

              <Button
                onPress={handleResetPassword}
                loading={isSubmitting}
                disabled={isSubmitting}
                fullWidth
                size="lg"
                className="mt-2"
              >
                재설정 링크 보내기
              </Button>
            </FormView>

            {/* Back to Login */}
            <View className="flex-row justify-center items-center mt-6">
              <Text className="text-gray-500 dark:text-gray-400">비밀번호가 기억나셨나요? </Text>
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
