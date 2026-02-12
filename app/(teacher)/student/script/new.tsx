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
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';

import { COLORS, NOTIFICATION_TYPES } from '@/lib/constants';
import { createScript } from '@/services/scripts';
import { notifyAction, deliverNotification } from '@/services/notifications';
import { getUserMessage } from '@/lib/errors';

export default function NewScriptScreen() {
  const { questionId, studentId } = useLocalSearchParams<{
    questionId: string;
    studentId: string;
  }>();

  const [content, setContent] = useState('');
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('알림', '스크립트 내용을 입력해주세요.');
      return;
    }

    if (!studentId || !questionId) {
      Alert.alert('오류', '학생 또는 질문 정보가 없습니다.');
      return;
    }

    setIsSaving(true);

    const { data: scriptData, error } = await createScript({
      studentId,
      questionId,
      content: content.trim(),
      comment: comment.trim() || undefined,
    });

    setIsSaving(false);

    if (error) {
      Alert.alert('오류', getUserMessage(error));
      return;
    }

    // 알림: 학생에게 새 스크립트 알림 (fire-and-forget)
    if (scriptData?.id) {
      notifyAction(NOTIFICATION_TYPES.NEW_SCRIPT, scriptData.id).then((result) => {
        if (result.success && result.notification_log_id && !result.already_exists) {
          deliverNotification(result.notification_log_id);
        }
      });
    }

    Alert.alert('완료', '스크립트가 저장되었습니다.', [
      {
        text: '확인',
        onPress: () => {
          // 학생 상세 화면으로 돌아가기
          router.navigate(`/(teacher)/student/${studentId}`);
        },
      },
    ]);
  };

  return (
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
        <Text style={styles.title}>스크립트 작성</Text>
        <Text style={styles.subtitle}>학생이 연습할 영어 스크립트를 작성하세요</Text>

        <Text style={styles.label}>스크립트 내용 *</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={10}
          value={content}
          onChangeText={setContent}
          placeholder="영어 스크립트를 작성하세요...&#10;&#10;예: Hello, my name is John. I'm a college student majoring in computer science..."
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
          disabled={isSaving}
        >
          <Text style={styles.cancelButtonText}>취소</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={COLORS.WHITE} />
          ) : (
            <Text style={styles.saveButtonText}>저장</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 24,
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
