import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { getUserMessage } from '@/lib/errors';
import { alert as xAlert } from '@/lib/alert';
import { STRATEGY_GROUP_INFO } from '@/lib/constants';
import { getTopicsWithStrategy } from '@/services/exams';

// 난이도 색상
const DIFFICULTY_COLORS = ['#10B981', '#34D399', '#FBBF24', '#F59E0B', '#EF4444'];

interface TopicWithStrategy {
  id: string;
  name_ko: string;
  name_en: string;
  icon: string | null;
  description: string | null;
  category: string;
  strategy_group: string | null;
  difficulty_hint: number | null;
  strategy_tip_ko: string | null;
}

export default function SurveyGuideScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const [topics, setTopics] = useState<TopicWithStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await getTopicsWithStrategy();
      if (error) {
        xAlert('오류', getUserMessage(error));
      } else {
        setTopics(data);
      }
      setIsLoading(false);
    })();
  }, []);

  // 그룹별로 토픽 분류
  const groupedTopics = useMemo(() => {
    const groups = new Map<string, TopicWithStrategy[]>();
    for (const topic of topics) {
      const group = topic.strategy_group || 'other';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(topic);
    }
    return groups;
  }, [topics]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* 핵심 전략 요약 */}
        <View style={[styles.strategyBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Ionicons name="bulb-outline" size={20} color={colors.primary} />
          <View style={styles.strategyBoxContent}>
            <Text style={[styles.strategyBoxTitle, { color: colors.primary }]}>서베이 선택 핵심 전략</Text>
            <Text style={[styles.strategyBoxText, { color: colors.textSecondary }]}>
              1. 같은 그룹의 토픽을 함께 선택하면 표현을 재활용할 수 있어 준비량이 줄어듭니다{'\n'}
              2. 난이도가 낮은 토픽 위주로 선택하면 답변하기 수월합니다{'\n'}
              3. 실제 경험이 있는 토픽을 선택하면 자연스러운 답변이 가능합니다{'\n'}
              4. 난이도 5~6은 동일하게 AL까지 가능하므로 5를 추천합니다
            </Text>
          </View>
        </View>

        {/* 추천 조합 */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>추천 토픽 조합</Text>
        <View style={[styles.comboCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.comboLabel, { color: colors.primary }]}>IH 목표 (안정적 조합)</Text>
          <Text style={[styles.comboText, { color: colors.textSecondary }]}>
            집/주거 + 이웃/동네 + 음악 + 영화 + TV + 쇼핑 + 요리 + 공원
          </Text>
          <Text style={[styles.comboReason, { color: colors.textDisabled }]}>
            생활/주거 + 엔터 + 일상 그룹 중심 — 묘사/루틴 표현 최대 재활용
          </Text>
        </View>
        <View style={[styles.comboCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.comboLabel, { color: colors.secondary }]}>AL 도전 조합</Text>
          <Text style={[styles.comboText, { color: colors.textSecondary }]}>
            집/주거 + 음악 + 영화 + 운동 + 여행 + 쇼핑 + 요리 + 공연
          </Text>
          <Text style={[styles.comboReason, { color: colors.textDisabled }]}>
            경험담이 풍부한 토픽 포함 — 비교/롤플레이 문항 대비
          </Text>
        </View>

        {/* 그룹별 토픽 목록 */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 24 }]}>토픽별 전략 가이드</Text>

        {Array.from(groupedTopics.entries()).map(([group, groupTopics]) => {
          const groupInfo = STRATEGY_GROUP_INFO[group];
          if (!groupInfo) return null;

          return (
            <View key={group} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <Ionicons
                  name={groupInfo.icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>{groupInfo.label}</Text>
                <Text style={[styles.groupDesc, { color: colors.textDisabled }]}>{groupInfo.description}</Text>
              </View>

              {groupTopics.map((topic) => {
                const isExpanded = expandedId === topic.id;
                const diffColor = DIFFICULTY_COLORS[(topic.difficulty_hint || 3) - 1];

                return (
                  <Pressable
                    key={topic.id}
                    style={[styles.topicItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setExpandedId(isExpanded ? null : topic.id)}
                  >
                    <View style={styles.topicRow}>
                      <Text style={styles.topicIcon}>{topic.icon || '📝'}</Text>
                      <View style={styles.topicInfo}>
                        <Text style={[styles.topicName, { color: colors.textPrimary }]}>{topic.name_ko}</Text>
                        <Text style={[styles.topicNameEn, { color: colors.textDisabled }]}>{topic.name_en}</Text>
                      </View>
                      <View style={[styles.diffBadge, { backgroundColor: diffColor + '20' }]}>
                        <Text style={[styles.diffText, { color: diffColor }]}>
                          {'★'.repeat(topic.difficulty_hint || 3)}
                        </Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textDisabled}
                      />
                    </View>

                    {isExpanded && topic.strategy_tip_ko && (
                      <View style={[styles.tipBox, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                        <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                          {topic.strategy_tip_ko}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* 하단 CTA */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.ctaButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push(routes.mockSurvey as any)}
        >
          <Text style={styles.ctaButtonText}>이 전략으로 모의고사 시작</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // 전략 요약 박스
  strategyBox: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 24,
  },
  strategyBoxContent: { flex: 1 },
  strategyBoxTitle: { fontSize: 14, fontFamily: 'Pretendard-Bold', marginBottom: 8 },
  strategyBoxText: { fontSize: 13, fontFamily: 'Pretendard-Regular', lineHeight: 22 },

  // 섹션
  sectionTitle: { fontSize: 17, fontFamily: 'Pretendard-Bold', marginBottom: 12 },

  // 추천 조합
  comboCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  comboLabel: { fontSize: 13, fontFamily: 'Pretendard-Bold', marginBottom: 6 },
  comboText: { fontSize: 13, fontFamily: 'Pretendard-Medium', lineHeight: 20, marginBottom: 4 },
  comboReason: { fontSize: 11, fontFamily: 'Pretendard-Regular' },

  // 그룹
  groupSection: { marginBottom: 16 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  groupTitle: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },
  groupDesc: { fontSize: 11, fontFamily: 'Pretendard-Regular', flex: 1, textAlign: 'right' },

  // 토픽 아이템
  topicItem: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topicIcon: { fontSize: 20 },
  topicInfo: { flex: 1 },
  topicName: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },
  topicNameEn: { fontSize: 11, fontFamily: 'Pretendard-Regular' },
  diffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  diffText: { fontSize: 10 },

  // 팁 박스
  tipBox: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  tipText: { flex: 1, fontSize: 12, fontFamily: 'Pretendard-Regular', lineHeight: 18 },

  // 하단
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
});
