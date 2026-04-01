import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { TopicGroupSelector, useTopicGroupToggle } from '@/components/TopicGroupSelector';
import { SURVEY_CONFIG, TOPIC_CATEGORIES } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import { alert as xAlert } from '@/lib/alert';
import { getTopics } from '@/services/scripts';
import { getTopicGroups } from '@/services/topics';
import type { TopicGroup } from '@/lib/types';
import type { TopicListItem } from '@/services/scripts';

export default function MockSurveyScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const [groups, setGroups] = useState<TopicGroup[]>([]);
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const { toggle } = useTopicGroupToggle(groups, topics);

  useEffect(() => {
    (async () => {
      const [groupsResult, topicsResult] = await Promise.all([
        getTopicGroups(),
        getTopics(),
      ]);

      if (groupsResult.error) {
        xAlert('오류', getUserMessage(groupsResult.error));
      } else if (groupsResult.data) {
        setGroups(groupsResult.data);
      }

      if (topicsResult.error) {
        xAlert('오류', getUserMessage(topicsResult.error));
      } else if (topicsResult.data) {
        // 서베이 토픽만 필터링 (자동 배정 토픽 제외 — UI에서 선택 불필요)
        setTopics(topicsResult.data.filter(
          (t) => t.category === TOPIC_CATEGORIES.SURVEY && !t.is_auto_assigned,
        ));
      }

      setIsLoading(false);
    })();
  }, []);

  const handleToggle = useCallback(
    (topicId: string, groupId: string | null) => {
      setSelectedIds((prev) => toggle(topicId, groupId, prev));
    },
    [toggle],
  );

  const handleNext = () => {
    if (selectedIds.size < SURVEY_CONFIG.TOTAL_MIN_SELECTIONS) {
      xAlert('토픽 선택', `최소 ${SURVEY_CONFIG.TOTAL_MIN_SELECTIONS}개의 토픽을 선택해주세요.`);
      return;
    }
    const topicIdsParam = Array.from(selectedIds).join(',');
    router.push(`${routes.mockAssessment}?topicIds=${topicIdsParam}` as any);
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* 전략 가이드 링크 */}
      <Pressable
        style={[styles.guideLink, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
        onPress={() => router.push(routes.surveyGuide as any)}
      >
        <Ionicons name="bulb-outline" size={18} color={colors.primary} />
        <Text style={[styles.guideLinkText, { color: colors.primary }]}>토픽 선택 전략 가이드 보기</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </Pressable>

      <TopicGroupSelector
        groups={groups}
        topics={topics}
        selectedIds={selectedIds}
        onToggle={handleToggle}
      />

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
          {selectedIds.size}개 선택됨
        </Text>
        <Pressable
          style={[styles.nextButton, { backgroundColor: colors.primary }, selectedIds.size < SURVEY_CONFIG.TOTAL_MIN_SELECTIONS && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={selectedIds.size < SURVEY_CONFIG.TOTAL_MIN_SELECTIONS}
        >
          <Text style={styles.nextButtonText}>다음</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  guideLinkText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  selectedCount: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextButtonText: { color: '#FFFFFF', fontFamily: 'Pretendard-SemiBold', fontSize: 15 },
  buttonDisabled: { opacity: 0.5 },
});
