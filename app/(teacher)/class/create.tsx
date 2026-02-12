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

import { COLORS } from '@/lib/constants';
import { createClass } from '@/services/classes';
import { getUserMessage } from '@/lib/errors';

export default function CreateClassScreen() {
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>반 만들기</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>반 이름 *</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 월요일 초급반"
            placeholderTextColor={COLORS.GRAY_400}
            value={name}
            onChangeText={setName}
            maxLength={50}
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>설명 (선택)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="반에 대한 메모를 입력하세요"
            placeholderTextColor={COLORS.GRAY_400}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={[styles.createButton, isSubmitting && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.WHITE} />
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
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
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
    color: COLORS.TEXT_PRIMARY,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 14,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  input: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_PRIMARY,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  createButton: {
    backgroundColor: COLORS.PRIMARY,
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
    color: COLORS.WHITE,
  },
});
