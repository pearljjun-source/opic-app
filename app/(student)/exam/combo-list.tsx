import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { EXAM_CONFIG, DIFFICULTY_GRADE_LABELS } from '@/lib/constants';
import { getRoleplayScenarios, getRoleplayScenarioDetail, checkExamAvailability, createExamSession } from '@/services/exams';
import { useAuth } from '@/hooks/useAuth';
import { getUserMessage } from '@/lib/errors';
import { alert as xAlert } from '@/lib/alert';
import type { RoleplayScenario } from '@/lib/types';
import type { GeneratedQuestion } from '@/services/exams';

const DIFFICULTY_LABELS = DIFFICULTY_GRADE_LABELS;

export default function ComboListScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const { currentOrg } = useAuth();
  const [scenarios, setScenarios] = useState<RoleplayScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const isStartingRef = useRef(false); // 이중 탭 가드

  useEffect(() => {
    (async () => {
      const { data, error } = await getRoleplayScenarios();
      if (error) {
        xAlert('오류', getUserMessage(error));
      } else {
        setScenarios(data);
      }
      setIsLoading(false);
    })();
  }, []);

  const handleSelectScenario = async (scenario: RoleplayScenario) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setStartingId(scenario.id);
    try {
      // 1. 가용 여부 확인
      const availability = await checkExamAvailability('combo_roleplay', EXAM_CONFIG.COMBO_QUESTION_COUNT);
      if (!availability.success) {
        xAlert('시험 불가', availability.error || '시험을 시작할 수 없습니다.');
        return;
      }

      // 2. 시나리오 상세 + 문항 조회
      const { data: detail, error: detailError } = await getRoleplayScenarioDetail(scenario.id);
      if (detailError || !detail) {
        xAlert('오류', getUserMessage(detailError) || '시나리오 조회에 실패했습니다.');
        return;
      }

      // 3. 문항 데이터를 GeneratedQuestion 형식으로 변환
      const questions: GeneratedQuestion[] = detail.questions.map((q, idx) => ({
        question_order: idx + 1,
        roleplay_question_id: q.id,
        question_text: q.question_text,
        question_type: q.roleplay_type,
        is_scored: true,
        combo_number: 1,
        combo_position: q.position,
        source: 'roleplay_question' as const,
      }));

      // 4. 세션 생성
      const { data: sessionData, error: sessionError } = await createExamSession({
        examType: 'combo_roleplay',
        roleplayScenarioId: scenario.id,
        organizationId: currentOrg?.id,
        questions,
      });

      if (sessionError || !sessionData) {
        xAlert('오류', getUserMessage(sessionError) || '세션 생성에 실패했습니다.');
        return;
      }

      // 5. 시험 시작
      const sessionParams = new URLSearchParams({
        sessionId: sessionData.sessionId,
        examType: 'combo_roleplay',
        questions: JSON.stringify(questions),
        scenarioContext: detail.scenario.scenario_context || '',
      });
      router.push(`${routes.session}?${sessionParams.toString()}` as any);
    } catch (err) {
      xAlert('오류', getUserMessage(err));
    } finally {
      setStartingId(null);
      isStartingRef.current = false;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={[styles.instruction, { color: colors.textSecondary }]}>
        롤플레이 시나리오를 선택하세요.{'\n'}
        각 시나리오는 질문하기 → 문제해결 → 관련경험 3문항으로 구성됩니다.
      </Text>

      {scenarios.map((scenario) => (
        <Pressable
          key={scenario.id}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => handleSelectScenario(scenario)}
          disabled={startingId !== null}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleArea}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{scenario.title_ko}</Text>
              <Text style={[styles.cardTitleEn, { color: colors.textSecondary }]}>{scenario.title_en}</Text>
            </View>
            {startingId === scenario.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={[styles.difficultyBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.difficultyText, { color: colors.primary }]}>
                  {DIFFICULTY_LABELS[scenario.difficulty] || `Lv.${scenario.difficulty}`}
                </Text>
              </View>
            )}
          </View>
          {scenario.description_ko && (
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              {scenario.description_ko}
            </Text>
          )}
          <View style={styles.cardFooter}>
            <Ionicons name="chatbubbles-outline" size={14} color={colors.textDisabled} />
            <Text style={[styles.cardFooterText, { color: colors.textDisabled }]}>3문항</Text>
          </View>
        </Pressable>
      ))}

      {scenarios.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textDisabled} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            등록된 롤플레이 시나리오가 없습니다.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24, paddingBottom: 48 },
  instruction: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleArea: { flex: 1, marginRight: 12 },
  cardTitle: { fontSize: 16, fontFamily: 'Pretendard-SemiBold' },
  cardTitleEn: { fontSize: 13, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: { fontSize: 12, fontFamily: 'Pretendard-Bold' },
  cardDesc: { fontSize: 13, fontFamily: 'Pretendard-Regular', lineHeight: 20, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardFooterText: { fontSize: 12, fontFamily: 'Pretendard-Regular' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Regular' },
});
