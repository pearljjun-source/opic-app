import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { EXAM_TYPE_LABELS, EXAM_CONFIG } from '@/lib/constants';
import { getMyExamSessions } from '@/services/exams';
import type { ExamSessionListItem, ExamType } from '@/lib/types';

const EXAM_CARDS: Array<{
  type: ExamType;
  icon: keyof typeof Ionicons.glyphMap;
  duration: string;
  questions: string;
  description: string;
}> = [
  {
    type: 'mock_exam',
    icon: 'school-outline',
    duration: '40분',
    questions: '12-15문항',
    description: '실제 OPIc과 동일한 환경에서\n서베이 → 자기평가 → 시험 → AI 등급 판정',
  },
  {
    type: 'combo_roleplay',
    icon: 'chatbubbles-outline',
    duration: '10분',
    questions: '3문항',
    description: '3연속 롤플레이 연습\n질문하기 → 문제해결 → 관련경험',
  },
  {
    type: 'level_test',
    icon: 'analytics-outline',
    duration: '15분',
    questions: '6문항',
    description: 'ACTFL 기준 레벨 테스트\n현재 OPIc 등급을 AI가 추정',
  },
];

export default function ExamHubScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const [recentExams, setRecentExams] = useState<ExamSessionListItem[]>([]);

  useEffect(() => {
    getMyExamSessions().then(({ data }) => {
      setRecentExams((data || []).slice(0, 3));
    }).catch((err) => {
      if (__DEV__) console.warn('[AppError] Recent exams load failed:', err);
    });
  }, []);

  const handleExamSelect = (type: ExamType) => {
    switch (type) {
      case 'mock_exam':
        router.push(routes.mockSurvey as any);
        break;
      case 'combo_roleplay':
        router.push(routes.comboList as any);
        break;
      case 'level_test':
        router.push({
          pathname: routes.session,
          params: { examType: 'level_test' },
        } as any);
        break;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>시험 유형 선택</Text>

      {EXAM_CARDS.map((card) => (
        <Pressable
          key={card.type}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => handleExamSelect(card.type)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={card.icon} size={24} color={colors.primary} />
            </View>
            <View style={styles.cardTitleArea}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {EXAM_TYPE_LABELS[card.type]}
              </Text>
              <View style={styles.cardMeta}>
                <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}>{card.duration}</Text>
                <Text style={[styles.cardMetaDot, { color: colors.textDisabled }]}> · </Text>
                <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}>{card.questions}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textDisabled} />
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            {card.description}
          </Text>
        </Pressable>
      ))}

      {/* 최근 시험 결과 */}
      {recentExams.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>최근 시험</Text>
            <Pressable onPress={() => router.push(routes.history as any)}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>전체 보기</Text>
            </Pressable>
          </View>
          {recentExams.map((exam) => (
            <Pressable
              key={exam.id}
              style={[styles.recentItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(routes.sessionDetail(exam.id) as any)}
            >
              <View style={styles.recentItemLeft}>
                <Text style={[styles.recentType, { color: colors.textPrimary }]}>
                  {EXAM_TYPE_LABELS[exam.exam_type]}
                </Text>
                <Text style={[styles.recentDate, { color: colors.textSecondary }]}>
                  {new Date(exam.started_at).toLocaleDateString('ko-KR')}
                </Text>
              </View>
              {exam.estimated_grade && (
                <View style={[styles.gradeBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.gradeText, { color: colors.primary }]}>{exam.estimated_grade}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleArea: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  cardMetaText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginLeft: 3,
  },
  cardMetaDot: {
    fontSize: 12,
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 20,
  },
  recentSection: {
    marginTop: 12,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  recentItemLeft: { flex: 1 },
  recentType: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  recentDate: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  gradeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gradeText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Bold',
  },
});
