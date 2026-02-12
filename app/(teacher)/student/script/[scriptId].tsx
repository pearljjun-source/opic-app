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

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import { getScript, updateScript, deleteScript, ScriptDetail } from '@/services/scripts';

export default function EditScriptScreen() {
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

    Alert.alert('완료', '스크립트가 수정되었습니다.', [
      {
        text: '확인',
        onPress: () => router.back(),
      },
    ]);
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

    Alert.alert('완료', '스크립트가 삭제되었습니다.', [
      {
        text: '확인',
        onPress: () => {
          // 학생 상세 화면으로 돌아가기
          if (script?.student_id) {
            router.navigate(`/(teacher)/student/${script.student_id}`);
          } else {
            router.back();
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>스크립트 불러오는 중...</Text>
      </View>
    );
  }

  if (error || !script) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || '스크립트를 찾을 수 없습니다'}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
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
                color={isDeleting ? COLORS.GRAY_300 : COLORS.ERROR}
              />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 질문 정보 */}
          <View style={styles.questionCard}>
            <View style={styles.topicBadge}>
              <Text style={styles.topicIcon}>{script.question.topic.icon || '📝'}</Text>
              <Text style={styles.topicName}>{script.question.topic.name_ko}</Text>
            </View>
            <Text style={styles.questionText}>{script.question.question_text}</Text>
          </View>

          <Text style={styles.label}>스크립트 내용 *</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={10}
            value={content}
            onChangeText={setContent}
            placeholder="영어 스크립트를 작성하세요..."
            placeholderTextColor={COLORS.GRAY_300}
            textAlignVertical="top"
          />

          <Text style={styles.label}>강사 코멘트/팁 (선택)</Text>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="학생에게 전달할 발음 팁이나 주의사항"
            placeholderTextColor={COLORS.GRAY_300}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={isSaving || isDeleting}
          >
            <Text style={styles.cancelButtonText}>취소</Text>
          </Pressable>
          <Pressable
            style={[styles.saveButton, (isSaving || isDeleting) && styles.saveButtonDisabled]}
            onPress={handleUpdate}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.WHITE} />
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
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  questionCard: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
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
    color: COLORS.PRIMARY,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_PRIMARY,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 200,
    marginBottom: 20,
    color: COLORS.TEXT_PRIMARY,
  },
  input: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    color: COLORS.TEXT_PRIMARY,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.GRAY_100,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_SECONDARY,
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
});
