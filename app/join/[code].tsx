import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/hooks/useAuth';
import { redeemInviteCode } from '@/services/invites';
import { deliverNotification } from '@/services/notifications';
import { useThemeColors } from '@/hooks/useTheme';
import { COLORS } from '@/lib/constants';

const PENDING_INVITE_KEY = 'pending_invite_code';

/**
 * /join/[code] — 공개 초대 진입점
 *
 * 3가지 시나리오:
 * 1. 인증됨 → 즉시 코드 사용 → 홈으로
 * 2. 미인증 → 코드 저장 → 가입/로그인 UI 표시
 * 3. 모바일 웹 → 위 + 앱 안내
 */
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isLoading, isAuthenticated, _profileVerified, refreshUser } = useAuth();
  const colors = useThemeColors();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  // 인증된 사용자: 즉시 코드 사용
  useEffect(() => {
    if (isLoading || !code || processedRef.current) return;

    if (isAuthenticated && _profileVerified) {
      processedRef.current = true;
      handleUseCode();
    }
  }, [isAuthenticated, isLoading, _profileVerified, code]);

  // 미인증 사용자: AsyncStorage에 코드 저장
  useEffect(() => {
    if (isLoading || !code) return;
    if (!isAuthenticated) {
      AsyncStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({
        code,
        timestamp: Date.now(),
      }));
    }
  }, [isAuthenticated, isLoading, code]);

  const handleUseCode = async () => {
    if (!code) return;
    setProcessing(true);
    setError(null);

    const result = await redeemInviteCode(code);

    if (result.success) {
      // 알림 배달 (fire-and-forget)
      if (result.notification_log_id) {
        deliverNotification(result.notification_log_id);
      }
      // 코드 사용 완료 → pending 삭제
      await AsyncStorage.removeItem(PENDING_INVITE_KEY);
      // 프로필 갱신 후 홈으로
      await refreshUser();
      if (result.role === 'owner' || result.role === 'teacher') {
        router.replace('/(teacher)' as any);
      } else {
        router.replace('/(student)' as any);
      }
    } else {
      setError(result.error || '초대 코드를 사용할 수 없습니다.');
      setProcessing(false);
    }
  };

  const handleGoToSignup = () => {
    router.push('/(auth)/signup');
  };

  const handleGoToLogin = () => {
    router.push('/(auth)/login');
  };

  const handleGoHome = () => {
    if (Platform.OS === 'web') {
      window.location.href = '/';
    } else {
      router.replace('/(auth)/login');
    }
  };

  // 로딩 중
  if (isLoading || (isAuthenticated && processing)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={[styles.processingText, { color: colors.textSecondary }]}>
          초대 코드 처리 중...
        </Text>
      </View>
    );
  }

  // 에러 표시 (인증된 사용자가 코드 사용 실패)
  if (error && isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>초대 실패</Text>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: COLORS.PRIMARY }]}
          onPress={handleGoHome}
        >
          <Text style={styles.primaryButtonText}>홈으로 이동</Text>
        </Pressable>
      </View>
    );
  }

  // 미인증 사용자: 초대 랜딩 UI
  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <View style={styles.content}>
        {/* 브랜딩 */}
        <View style={[styles.iconCircle, { backgroundColor: COLORS.PRIMARY + '15' }]}>
          <Ionicons name="mail-open-outline" size={48} color={COLORS.PRIMARY} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Speaky에 초대되었습니다</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          초대 코드: <Text style={[styles.codeHighlight, { color: COLORS.PRIMARY }]}>{code}</Text>
        </Text>

        {error && (
          <Text style={[styles.errorText, { color: colors.error, marginBottom: 16 }]}>{error}</Text>
        )}

        <Text style={[styles.description, { color: colors.textSecondary }]}>
          회원가입 후 자동으로 학원에 연결됩니다.{'\n'}
          이미 계정이 있다면 로그인하세요.
        </Text>

        {/* CTA 버튼 */}
        <Pressable
          style={[styles.primaryButton, { backgroundColor: COLORS.PRIMARY }]}
          onPress={handleGoToSignup}
        >
          <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>회원가입</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, { borderColor: COLORS.PRIMARY }]}
          onPress={handleGoToLogin}
        >
          <Ionicons name="log-in-outline" size={20} color={COLORS.PRIMARY} />
          <Text style={[styles.secondaryButtonText, { color: COLORS.PRIMARY }]}>로그인</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  codeHighlight: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    letterSpacing: 2,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  processingText: {
    marginTop: 16,
    fontSize: 15,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
});
