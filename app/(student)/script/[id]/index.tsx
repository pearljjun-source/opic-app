import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { alert as xAlert } from '@/lib/alert';
import { useThemeColors } from '@/hooks/useTheme';
import { getStudentScript, updateScriptAsStudent, StudentScriptDetail } from '@/services/scripts';
import { getUserMessage } from '@/lib/errors';

export default function ScriptViewScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [script, setScript] = useState<StudentScriptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 수정 모드
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const loadScript = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        const { data, error: fetchError } = await getStudentScript(id);

        if (fetchError) {
          setError(getUserMessage(fetchError));
        } else {
          setScript(data);
          setError(null);
        }
      } catch (err) {
        setError(getUserMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadScript();
  }, [id]);

  const handleShadowing = () => {
    router.push(`/(student)/script/${id}/shadowing`);
  };

  const handleTranslationPractice = () => {
    router.push(`/(student)/script/${id}/translation-practice`);
  };

  const handlePractice = () => {
    router.push(`/(student)/script/${id}/practice`);
  };

  const handleStartEdit = () => {
    if (!script) return;
    setEditContent(script.content);
    setIsEditing(true);
    setTimeout(() => textInputRef.current?.focus(), 100);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleSave = async () => {
    if (!id || !script) return;

    const trimmed = editContent.trim();
    if (!trimmed) {
      xAlert('오류', '스크립트 내용을 입력해주세요.');
      return;
    }

    if (trimmed === script.content) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const { error: saveError } = await updateScriptAsStudent({
        scriptId: id,
        content: trimmed,
      });

      if (saveError) {
        xAlert('오류', getUserMessage(saveError));
      } else {
        setScript({ ...script, content: trimmed, content_ko: null });
        setIsEditing(false);
      }
    } catch (err) {
      xAlert('오류', getUserMessage(err));
    } finally {
      setIsSaving(false);
    }
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
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error || '스크립트를 찾을 수 없습니다'}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 질문 */}
        <View style={[styles.questionCard, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="help-circle" size={20} color={colors.primary} />
          <Text style={[styles.questionText, { color: colors.primary }]}>{script.question.question_text}</Text>
        </View>

        {/* 스크립트 */}
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>스크립트</Text>
          {!isEditing && (
            <Pressable style={styles.editButton} onPress={handleStartEdit}>
              <Ionicons name="pencil" size={14} color={colors.primary} />
              <Text style={[styles.editButtonText, { color: colors.primary }]}>수정</Text>
            </Pressable>
          )}
        </View>

        {isEditing ? (
          <View style={[styles.scriptBox, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}>
            <TextInput
              ref={textInputRef}
              style={[styles.scriptInput, { color: colors.textPrimary }]}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              textAlignVertical="top"
              placeholder="스크립트 내용을 입력하세요"
              placeholderTextColor={colors.textSecondary}
              editable={!isSaving}
            />
            <View style={styles.editActions}>
              <Pressable
                style={[styles.editActionButton, { backgroundColor: colors.surfaceSecondary }]}
                onPress={handleCancelEdit}
                disabled={isSaving}
              >
                <Text style={[styles.editActionText, { color: colors.textSecondary }]}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.editActionButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.editActionText, { color: '#FFFFFF' }]}>저장</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.scriptBox, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}>
            <Text style={[styles.scriptText, { color: colors.textPrimary }]}>{script.content}</Text>
          </View>
        )}

        {/* 강사 코멘트 */}
        {script.comment && (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>강사 코멘트</Text>
            <View style={[styles.commentBox, { backgroundColor: colors.warning + '15' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.warning} />
              <Text style={[styles.commentText, { color: colors.textPrimary }]}>{script.comment}</Text>
            </View>
          </>
        )}

        {/* 팁 */}
        <View style={[styles.tipBox, { backgroundColor: colors.secondary + '15' }]}>
          <Ionicons name="bulb-outline" size={18} color={colors.secondary} />
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            쉐도잉 → 한→영 연습 → 실전 연습{'\n'}
            순서로 단계별 학습을 추천합니다!
          </Text>
        </View>
      </ScrollView>

      {!isEditing && (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.buttonRow}>
            <Pressable style={[styles.outlineButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={handleShadowing}>
              <Ionicons name="headset" size={18} color={colors.primary} />
              <Text style={[styles.outlineButtonText, { color: colors.primary }]}>쉐도잉</Text>
            </Pressable>
            <Pressable style={[styles.outlineButton, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary }]} onPress={handleTranslationPractice}>
              <Ionicons name="language" size={18} color={colors.secondary} />
              <Text style={[styles.outlineButtonText, { color: colors.secondary }]}>한→영</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.practiceButton, { backgroundColor: colors.primary }]} onPress={handlePractice}>
            <Ionicons name="mic" size={20} color="#FFFFFF" />
            <Text style={styles.practiceButtonText}>실전 연습</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
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
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 10,
  },
  questionText: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
    lineHeight: 24,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editButtonText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  scriptBox: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  scriptText: {
    fontSize: 16,
    lineHeight: 26,
  },
  scriptInput: {
    fontSize: 16,
    lineHeight: 26,
    minHeight: 120,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  editActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  editActionText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
  },
  commentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
  },
  outlineButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  practiceButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  practiceButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
});
