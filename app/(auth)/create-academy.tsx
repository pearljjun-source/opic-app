import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { createOrganization } from '@/services/organizations';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useTheme';

/**
 * 학원 생성 화면
 *
 * 신규 가입 후 "학원 만들기" 선택 시 표시.
 * 학원 생성 → owner 멤버십 자동 생성 → 강사 홈으로 이동.
 */
export default function CreateAcademyScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const colors = useThemeColors();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('학원 이름을 입력해주세요.');
      return;
    }

    setIsCreating(true);
    setError(null);

    const result = await createOrganization(trimmed);

    if (result.success) {
      // useAuth가 refreshUser로 org 정보 갱신 → 라우팅 자동 이동
      await refreshUser();
    } else {
      setError(result.error || '학원 생성에 실패했습니다.');
    }

    setIsCreating(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <Ionicons name="business" size={56} color={colors.primary} style={styles.icon} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>학원 만들기</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          학원을 만들면 원장으로 등록됩니다.{'\n'}
          이후 강사와 학생을 초대할 수 있습니다.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>학원 이름</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="예: OPIc 영어학원"
            placeholderTextColor={colors.textDisabled}
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoFocus
          />
        </View>

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.accentRedBg }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }, (!name.trim() || isCreating) && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || isCreating}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>학원 생성</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
});
