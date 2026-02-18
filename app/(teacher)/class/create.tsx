import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { createClass } from '@/services/classes';
import { getUserMessage } from '@/lib/errors';
import { useThemeColors } from '@/hooks/useTheme';

export default function CreateClassScreen() {
  const colors = useThemeColors();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('반 이름을 입력해주세요');
      return;
    }
    if (trimmedName.length > 50) {
      setError('반 이름은 최대 50자까지 가능합니다');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createClass(trimmedName, description.trim() || undefined);
      if (result.success) {
        router.back();
      } else {
        setError(result.error || '반 생성에 실패했습니다');
      }
    } catch (err) {
      setError(getUserMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>반 만들기</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.accentPinkBg }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>반 이름 *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="예: 월요일 초급반"
            placeholderTextColor={colors.textDisabled}
            value={name}
            onChangeText={setName}
            maxLength={50}
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>설명 (선택)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="반에 대한 메모를 입력하세요"
            placeholderTextColor={colors.textDisabled}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={[styles.createButton, { backgroundColor: colors.primary }, isSubmitting && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>만들기</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
  },
  content: {
    padding: 16,
    gap: 20,
  },
  errorContainer: {
    borderRadius: 16,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  createButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
  },
});
