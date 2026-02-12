import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getStudentScript, StudentScriptDetail } from '@/services/scripts';
import { getUserMessage } from '@/lib/errors';

export default function ScriptViewScreen() {
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>스크립트 불러오는 중...</Text>
      </View>
    );
  }

  if (error || !script) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.ERROR} />
        <Text style={styles.errorText}>{error || '스크립트를 찾을 수 없습니다'}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 질문 */}
        <View style={styles.questionCard}>
          <Ionicons name="help-circle" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.questionText}>{script.question.question_text}</Text>
        </View>

        {/* 스크립트 */}
        <Text style={styles.label}>스크립트</Text>
        <View style={styles.scriptBox}>
          <Text style={styles.scriptText}>{script.content}</Text>
        </View>

        {/* 강사 코멘트 */}
        {script.comment && (
          <>
            <Text style={styles.label}>강사 코멘트</Text>
            <View style={styles.commentBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.WARNING} />
              <Text style={styles.commentText}>{script.comment}</Text>
            </View>
          </>
        )}

        {/* 팁 */}
        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={18} color={COLORS.SECONDARY} />
          <Text style={styles.tipText}>
            먼저 쉐도잉으로 발음을 연습한 후,{'\n'}
            실전 연습으로 스크립트 없이 말해보세요!
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          <Pressable style={styles.shadowingButton} onPress={handleShadowing}>
            <Ionicons name="headset" size={20} color={COLORS.PRIMARY} />
            <Text style={styles.shadowingButtonText}>쉐도잉</Text>
          </Pressable>
          <Pressable style={styles.practiceButton} onPress={handlePractice}>
            <Ionicons name="mic" size={20} color={COLORS.WHITE} />
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
    marginTop: 12,
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
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
  content: {
    flex: 1,
    padding: 16,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.PRIMARY + '15',
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
    color: COLORS.PRIMARY,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  scriptBox: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  scriptText: {
    fontSize: 16,
    lineHeight: 26,
    color: COLORS.TEXT_PRIMARY,
  },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.WARNING + '15',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
  },
  commentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.TEXT_PRIMARY,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.SECONDARY + '15',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.TEXT_SECONDARY,
  },
  footer: {
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
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
    backgroundColor: COLORS.PRIMARY + '15',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  shadowingButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
  },
  practiceButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  practiceButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
});
