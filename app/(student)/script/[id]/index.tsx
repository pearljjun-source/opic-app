import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getStudentScript, StudentScriptDetail } from '@/services/scripts';
import { getUserMessage } from '@/lib/errors';

export default function ScriptViewScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [script, setScript] = useState<StudentScriptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handlePractice = () => {
    router.push(`/(student)/script/${id}/practice`);
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
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 질문 */}
        <View style={[styles.questionCard, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="help-circle" size={20} color={colors.primary} />
          <Text style={[styles.questionText, { color: colors.primary }]}>{script.question.question_text}</Text>
        </View>

        {/* 스크립트 */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>스크립트</Text>
        <View style={[styles.scriptBox, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}>
          <Text style={[styles.scriptText, { color: colors.textPrimary }]}>{script.content}</Text>
        </View>

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
            먼저 쉐도잉으로 발음을 연습한 후,{'\n'}
            실전 연습으로 스크립트 없이 말해보세요!
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.buttonRow}>
          <Pressable style={[styles.shadowingButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={handleShadowing}>
            <Ionicons name="headset" size={20} color={colors.primary} />
            <Text style={[styles.shadowingButtonText, { color: colors.primary }]}>쉐도잉</Text>
          </Pressable>
          <Pressable style={[styles.practiceButton, { backgroundColor: colors.primary }]} onPress={handlePractice}>
            <Ionicons name="mic" size={20} color="#FFFFFF" />
            <Text style={styles.practiceButtonText}>실전 연습</Text>
          </Pressable>
        </View>
      </View>
    </View>
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
  label: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 8,
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
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shadowingButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  shadowingButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  practiceButton: {
    flex: 1,
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
