import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { SELF_ASSESSMENT_LEVELS } from '@/lib/constants';
import { generateMockExamQuestions, checkExamAvailability, createExamSession } from '@/services/exams';
import { useAuth } from '@/hooks/useAuth';
import { getUserMessage } from '@/lib/errors';

export default function MockAssessmentScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const { topicIds } = useLocalSearchParams<{ topicIds: string }>();
  const { currentOrg } = useAuth();

  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isStartingRef = useRef(false); // 이중 탭 가드 (useState 렌더 사이클 갭 방지)

  const handleStart = async () => {
    if (!selectedLevel || !topicIds) return;
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    setIsLoading(true);
    try {
      // 1. 시험 가능 여부 확인
      const availability = await checkExamAvailability('mock_exam', 15);
      if (!availability.success) {
        Alert.alert('시험 불가', availability.error || '시험을 시작할 수 없습니다.');
        return;
      }

      // 2. 문제 생성
      const surveyTopicIds = topicIds.split(',');
      const { data: questionData, error: questionError } = await generateMockExamQuestions(
        selectedLevel,
        surveyTopicIds,
      );

      if (questionError || !questionData) {
        Alert.alert('오류', getUserMessage(questionError) || '문제 생성에 실패했습니다.');
        return;
      }

      // 3. 세션 생성
      const { data: sessionData, error: sessionError } = await createExamSession({
        examType: 'mock_exam',
        selfAssessmentLevel: selectedLevel,
        surveyTopics: surveyTopicIds,
        organizationId: currentOrg?.id,
        questions: questionData.questions,
      });

      if (sessionError || !sessionData) {
        Alert.alert('오류', getUserMessage(sessionError) || '시험 세션 생성에 실패했습니다.');
        return;
      }

      // 4. 시험 시작
      router.replace({
        pathname: routes.session,
        params: {
          sessionId: sessionData.sessionId,
          examType: 'mock_exam',
          questions: JSON.stringify(questionData.questions),
        },
      } as any);
    } catch (err) {
      Alert.alert('오류', getUserMessage(err));
    } finally {
      setIsLoading(false);
      isStartingRef.current = false;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.instruction, { color: colors.textSecondary }]}>
          자신의 영어 실력에 가장 가까운 레벨을 선택하세요.{'\n'}
          선택한 레벨에 따라 문항 수와 난이도가 조절됩니다.
        </Text>

        {SELF_ASSESSMENT_LEVELS.map((item) => {
          const isSelected = selectedLevel === item.level;
          return (
            <Pressable
              key={item.level}
              style={[
                styles.levelItem,
                { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                isSelected && { borderWidth: 2 },
              ]}
              onPress={() => setSelectedLevel(item.level)}
            >
              <View style={[styles.levelBadge, { backgroundColor: isSelected ? colors.primary : colors.primaryLight }]}>
                <Text style={[styles.levelBadgeText, { color: isSelected ? '#FFFFFF' : colors.primary }]}>
                  {item.level}
                </Text>
              </View>
              <View style={styles.levelInfo}>
                <Text style={[styles.levelLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                <Text style={[styles.levelDesc, { color: colors.textSecondary }]}>{item.description}</Text>
              </View>
              <View style={styles.levelMeta}>
                <Text style={[styles.questionCount, { color: colors.textSecondary }]}>
                  {item.questionCount}문항
                </Text>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={isSelected ? colors.primary : colors.textDisabled}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.startButton, { backgroundColor: colors.primary }, (!selectedLevel || isLoading) && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={!selectedLevel || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.startButtonText}>시험 시작</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 120 },
  instruction: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 22,
    marginBottom: 20,
  },
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  levelBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  levelBadgeText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
  },
  levelInfo: { flex: 1 },
  levelLabel: { fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
  levelDesc: { fontSize: 12, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  levelMeta: { alignItems: 'flex-end', gap: 4 },
  questionCount: { fontSize: 12, fontFamily: 'Pretendard-Medium' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButtonText: { color: '#FFFFFF', fontFamily: 'Pretendard-SemiBold', fontSize: 16 },
  buttonDisabled: { opacity: 0.5 },
});
