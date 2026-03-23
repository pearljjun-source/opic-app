import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { EXAM_CONFIG } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import { alert as xAlert } from '@/lib/alert';
import { getSurveyTopics } from '@/services/exams';
import type { Topic } from '@/lib/types';

export default function MockSurveyScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await getSurveyTopics();
      if (error) {
        xAlert('오류', getUserMessage(error));
      } else {
        setTopics(data);
      }
      setIsLoading(false);
    })();
  }, []);

  const toggleTopic = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNext = () => {
    if (selectedIds.size < EXAM_CONFIG.MIN_SURVEY_TOPICS) {
      xAlert('토픽 선택', `최소 ${EXAM_CONFIG.MIN_SURVEY_TOPICS}개의 토픽을 선택해주세요.`);
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
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.instruction, { color: colors.textSecondary }]}>
          실제 OPIc 시험처럼 관심 있는 토픽을 선택하세요. (최소 {EXAM_CONFIG.MIN_SURVEY_TOPICS}개)
        </Text>

        {/* 전략 가이드 링크 */}
        <Pressable
          style={[styles.guideLink, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
          onPress={() => router.push(routes.surveyGuide as any)}
        >
          <Ionicons name="bulb-outline" size={18} color={colors.primary} />
          <Text style={[styles.guideLinkText, { color: colors.primary }]}>토픽 선택 전략 가이드 보기</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>

        {topics.map((topic) => {
          const isSelected = selectedIds.has(topic.id);
          return (
            <Pressable
              key={topic.id}
              style={[
                styles.topicItem,
                { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                isSelected && { borderWidth: 2 },
              ]}
              onPress={() => toggleTopic(topic.id)}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                <Ionicons
                  name={(topic.icon as keyof typeof Ionicons.glyphMap) || 'document-text-outline'}
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.topicInfo}>
                <Text style={[styles.topicName, { color: colors.textPrimary }]}>{topic.name_ko}</Text>
                <Text style={[styles.topicDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                  {topic.description}
                </Text>
              </View>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={isSelected ? colors.primary : colors.textDisabled}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
          {selectedIds.size}개 선택됨
        </Text>
        <Pressable
          style={[styles.nextButton, { backgroundColor: colors.primary }, selectedIds.size < EXAM_CONFIG.MIN_SURVEY_TOPICS && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={selectedIds.size < EXAM_CONFIG.MIN_SURVEY_TOPICS}
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
  scrollArea: { flex: 1 },
  scrollContent: { padding: 24 },
  instruction: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 22,
    marginBottom: 12,
  },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  guideLinkText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  iconContainer: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  topicInfo: { flex: 1 },
  topicName: { fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
  topicDesc: { fontSize: 12, fontFamily: 'Pretendard-Regular', marginTop: 2 },
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
