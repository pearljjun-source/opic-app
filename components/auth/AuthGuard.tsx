import { ReactNode } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * AuthGuard - 인증된 사용자만 접근 가능하도록 보호
 *
 * 사용법:
 * ```tsx
 * <AuthGuard>
 *   <ProtectedContent />
 * </AuthGuard>
 * ```
 *
 * 참고: useAuth 훅에서 이미 전역 라우팅 보호를 처리하지만,
 * 이 컴포넌트는 특정 컴포넌트 레벨에서 추가 보호가 필요할 때 사용
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      fallback || (
        <View className="flex-1 justify-center items-center bg-white">
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text className="text-gray-500 mt-4">로딩 중...</Text>
        </View>
      )
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <>{children}</>;
}

export default AuthGuard;
