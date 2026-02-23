import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { getUserMessage } from '@/lib/errors';
import { getScript, updateScript, deleteScript, ScriptDetail } from '@/services/scripts';
import { useThemeColors } from '@/hooks/useTheme';
import { showToast } from '@/lib/toast';

export default function EditScriptScreen() {
  const colors = useThemeColors();
  const { scriptId } = useLocalSearchParams<{ scriptId: string }>();

  const [script, setScript] = useState<ScriptDetail | null>(null);
  const [content, setContent] = useState('');
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 스크립트 불러오기
  useEffect(() => {
    const loadScript = async () => {
      if (!scriptId) return;

      setIsLoading(true);
      const { data, error: fetchError } = await getScript(scriptId);

      if (fetchError) {
        setError(getUserMessage(fetchError));
      } else if (data) {
        setScript(data);
        setContent(data.content);
        setComment(data.comment || '');
        setError(null);
      }
      setIsLoading(false);
    };

    loadScript();
  }, [scriptId]);

  const handleUpdate = async () => {
    if (!content.trim()) {
      Alert.alert('알림', '스크립트 내용을 입력해주세요.');
      return;
    }

    if (!scriptId) {
      Alert.alert('오류', '스크립트 정보가 없습니다.');
      return;
    }

    setIsSaving(true);

    const { error: updateError } = await updateScript({
      scriptId,
      content: content.trim(),
      comment: comment.trim() || undefined,
    });

    setIsSaving(false);

    if (updateError) {
      Alert.alert('오류', getUserMessage(updateError));
      return;
    }

    showToast('스크립트가 수정되었습니다.');
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      '스크립트 삭제',
      '정말 이 스크립트를 삭제하시겠습니까?\n삭제된 스크립트는 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (!scriptId) return;

    setIsDeleting(true);

    const { error: deleteError } = await deleteScript(scriptId);

    setIsDeleting(false);

    if (deleteError) {
      Alert.alert('오류', getUserMessage(deleteError));
      return;
    }

    showToast('스크립트가 삭제되었습니다.');
    router.back();
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>스크립트 불러오는 중...</Text>
      </View>
    );
  }

  if (error || !script) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error || '스크립트를 찾을 수 없습니다'}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '스크립트 수정',
          headerBackTitle: '취소',
          headerRight: () => (
            <Pressable onPress={handleDelete} disabled={isDeleting}>
              <Ionicons
                name="trash-outline"
                size={24}
                color={isDeleting ? colors.gray300 : colors.error}
              />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 질문 정보 */}
          <View style={[styles.questionCard, { backgroundColor: colors.primary + '10', borderLeftColor: colors.primary }]}>
            <View style={styles.topicBadge}>
              <Text style={styles.topicIcon}>{script.question.topic.icon || '📝'}</Text>
              <Text style={[styles.topicName, { color: colors.primary }]}>{script.question.topic.name_ko}</Text>
            </View>
            <Text style={[styles.questionText, { color: colors.textPrimary }]}>{script.question.question_text}</Text>
          </View>

          <Text style={[styles.label, { color: colors.textPrimary }]}>스크립트 내용 *</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            multiline
            numberOfLines={10}
            value={content}
            onChangeText={setContent}
            placeholder="영어 스크립트를 작성하세요..."
            placeholderTextColor={colors.gray300}
            textAlignVertical="top"
          />

          <Text style={[styles.label, { color: colors.textPrimary }]}>강사 코멘트/팁 (선택)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            value={comment}
            onChangeText={setComment}
            placeholder="학생에게 전달할 발음 팁이나 주의사항"
            placeholderTextColor={colors.gray300}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.cancelButton, { backgroundColor: colors.borderLight }]}
            onPress={() => router.back()}
            disabled={isSaving || isDeleting}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>취소</Text>
          </Pressable>
          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.primary }, (isSaving || isDeleting) && styles.saveButtonDisabled]}
            onPress={handleUpdate}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>수정 완료</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  questionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
  },
  topicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  topicName: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 200,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
});
