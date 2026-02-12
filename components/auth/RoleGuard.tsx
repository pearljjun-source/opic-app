import { ReactNode } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import type { UserRole } from '@/lib/types';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * RoleGuard - 특정 역할의 사용자만 접근 가능하도록 보호
 *
 * 사용법:
 * ```tsx
 * <RoleGuard allowedRoles={['teacher']}>
 *   <TeacherOnlyContent />
 * </RoleGuard>
 *
 * <RoleGuard allowedRoles={['teacher', 'admin']} redirectTo="/(student)">
 *   <AdminOrTeacherContent />
 * </RoleGuard>
 * ```
 *
 * 참고: useAuth 훅에서 이미 역할 기반 라우팅을 처리하지만,
 * 이 컴포넌트는 특정 컴포넌트나 기능에 대한 세밀한 접근 제어가 필요할 때 사용
 */
export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  redirectTo,
}: RoleGuardProps) {
  const { isAuthenticated, isLoading, role } = useAuth();

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

  if (!role || !allowedRoles.includes(role)) {
    // 역할이 없거나 허용되지 않은 역할
    if (redirectTo) {
      return <Redirect href={redirectTo as any} />;
    }

    // 기본: 역할에 따른 홈으로 리다이렉트
    if (role === 'teacher') {
      return <Redirect href="/(teacher)" />;
    } else if (role === 'student') {
      return <Redirect href="/(student)" />;
    }

    // 역할이 없으면 로그인으로
    return <Redirect href="/(auth)/login" />;
  }

  return <>{children}</>;
}

export default RoleGuard;
