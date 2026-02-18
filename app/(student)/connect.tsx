import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';

import { useThemeColors } from '@/hooks/useTheme';
import { useInviteCode } from '@/services/invites';
import { deliverNotification } from '@/services/notifications';
import { useAuth } from '@/hooks/useAuth';

export default function ConnectScreen() {
  const colors = useThemeColors();
  const { refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    if (code.length !== 6) {
      setError('6자리 코드를 입력하세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await useInviteCode(code);

    if (result.success) {
      // 알림: 강사에게 학생 연결 알림 (fire-and-forget)
      if (result.notification_log_id) {
        deliverNotification(result.notification_log_id);
      }
      // 조직 멤버십 갱신 → useAuth 라우팅이 올바른 화면으로 이동
      await refreshUser();
      if (result.role === 'owner' || result.role === 'teacher') {
        router.replace('/(teacher)' as any);
      } else {
        router.replace('/(student)' as any);
      }
    } else {
      setError(result.error || '연결에 실패했습니다.');
    }

    setIsLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>초대 코드를 입력하세요.</Text>

      <TextInput
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
        value={code}
        onChangeText={(text) => {
          setCode(text.toUpperCase());
          setError('');
        }}
        placeholder="ABC123"
        placeholderTextColor={colors.textDisabled}
        maxLength={6}
        autoCapitalize="characters"
      />

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }, isLoading && styles.buttonDisabled]}
        onPress={handleConnect}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>연결하기</Text>
        )}
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 8,
  },
  error: {
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
});
