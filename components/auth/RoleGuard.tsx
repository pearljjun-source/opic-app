import { ReactNode } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { canTeach } from '@/lib/permissions';
import type { OrgRole, PlatformRole } from '@/lib/types';

interface RoleGuardProps {
  children: ReactNode;
  /** 조직 레벨 역할 체크 (owner, teacher, student) */
  allowedOrgRoles?: OrgRole[];
  /** 플랫폼 레벨 역할 체크 (super_admin) */
  allowedPlatformRoles?: PlatformRole[];
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * RoleGuard - 역할 기반 접근 제어
 *
 * 사용법:
 * ```tsx
 * <RoleGuard allowedOrgRoles={['owner', 'teacher']}>
 *   <TeacherOnlyContent />
 * </RoleGuard>
 *
 * <RoleGuard allowedPlatformRoles={['super_admin']}>
 *   <AdminContent />
 * </RoleGuard>
 *
 * <RoleGuard allowedOrgRoles={['owner']}>
 *   <OwnerOnlyContent />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({
  children,
  allowedOrgRoles,
  allowedPlatformRoles,
  fallback,
  redirectTo,
}: RoleGuardProps) {
  const { isAuthenticated, isLoading, orgRole, platformRole, role } = useAuth();

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

  // Platform role check
  if (allowedPlatformRoles && allowedPlatformRoles.length > 0) {
    if (platformRole && allowedPlatformRoles.includes(platformRole)) {
      return <>{children}</>;
    }
  }

  // Org role check
  if (allowedOrgRoles && allowedOrgRoles.length > 0) {
    if (orgRole && allowedOrgRoles.includes(orgRole)) {
      return <>{children}</>;
    }
  }

  // No matching role — redirect
  if (redirectTo) {
    return <Redirect href={redirectTo as any} />;
  }

  // Default redirect based on role
  if (platformRole === 'super_admin' || role === 'admin') {
    return <Redirect href={"/(admin)" as any} />;
  } else if (canTeach(orgRole)) {
    return <Redirect href={"/(teacher)" as any} />;
  } else {
    return <Redirect href={"/(student)" as any} />;
  }
}

export default RoleGuard;
