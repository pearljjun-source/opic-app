import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';

import { COLORS } from '@/lib/constants';
import { useInviteCode } from '@/services/invites';
import { deliverNotification } from '@/services/notifications';

export default function ConnectScreen() {
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
      router.replace('/(student)');
    } else {
      setError(result.error || '연결에 실패했습니다.');
    }

    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>강사에게 받은 초대 코드를 입력하세요.</Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(text) => {
          setCode(text.toUpperCase());
          setError('');
        }}
        placeholder="ABC123"
        maxLength={6}
        autoCapitalize="characters"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleConnect}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={COLORS.WHITE} />
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
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  subtitle: {
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 8,
    backgroundColor: COLORS.WHITE,
  },
  error: {
    color: COLORS.ERROR,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.WHITE,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
});
