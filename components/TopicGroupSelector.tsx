import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useMemo, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { SURVEY_CONFIG, TOPIC_CATEGORIES } from '@/lib/constants';
import type { TopicGroup } from '@/lib/types';
import type { TopicListItem } from '@/services/scripts';

// ============================================================================
// Types
// ============================================================================

interface TopicGroupSelectorProps {
  /** 토픽 그룹 목록 (sort_order 순) */
  groups: TopicGroup[];
  /** 전체 토픽 목록 (group_id 포함) */
  topics: TopicListItem[];
  /** 현재 선택된 토픽 ID 세트 */
  selectedIds: Set<string>;
  /** 토픽 선택/해제 콜백 */
  onToggle: (topicId: string, groupId: string | null) => void;
  /** 서베이 토픽만 표시 (기본: true) */
  surveyOnly?: boolean;
  /** 돌발 토픽 포함 여부 (기본: false) */
  showUnexpected?: boolean;
  /** 프로필 선택 섹션 (Q1~Q3) — ScrollView 상단에 렌더링 */
  profileSection?: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function TopicGroupSelector({
  groups,
  topics,
  selectedIds,
  onToggle,
  surveyOnly = true,
  showUnexpected = false,
  profileSection,
}: TopicGroupSelectorProps) {
  const colors = useThemeColors();

  // 그룹별 토픽 맵
  const groupedTopics = useMemo(() => {
    const map = new Map<string, TopicListItem[]>();

    // 서베이 토픽: group_id 기준
    for (const group of groups) {
      map.set(
        group.id,
        topics.filter((t) => t.group_id === group.id && t.category === TOPIC_CATEGORIES.SURVEY),
      );
    }

    return map;
  }, [groups, topics]);

  // 자동 배정 토픽 (자기소개, 집/거주, 이웃/동네 — 서버가 자동 추가)
  const autoAssignedTopics = useMemo(() => {
    return topics.filter((t) => t.is_auto_assigned);
  }, [topics]);

  // 돌발 토픽 (category='unexpected')
  const unexpectedTopics = useMemo(
    () => topics.filter((t) => t.category === TOPIC_CATEGORIES.UNEXPECTED),
    [topics],
  );

  // 그룹별 선택 수
  const groupSelectionCount = useCallback(
    (groupId: string) => {
      const groupTopics = groupedTopics.get(groupId) || [];
      return groupTopics.filter((t) => selectedIds.has(t.id)).length;
    },
    [groupedTopics, selectedIds],
  );

  // 서베이 토픽 총 선택 수
  // 서베이 토픽 총 선택 수 (자동 배정 제외 — 사용자가 직접 고른 것만)
  const totalSurveySelected = useMemo(() => {
    return topics.filter(
      (t) => t.category === TOPIC_CATEGORIES.SURVEY && !t.is_auto_assigned && selectedIds.has(t.id),
    ).length;
  }, [topics, selectedIds]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 프로필 섹션 (Q1~Q3) */}
      {profileSection && (
        <View style={styles.profileSection}>
          {profileSection}
        </View>
      )}

      {/* Q4~Q7 활동 토픽 선택 */}
      {profileSection && (
        <Text style={[styles.activitySectionTitle, { color: colors.textPrimary }]}>
          Q4~Q7. 활동 선택
        </Text>
      )}

      {/* 총 선택 수 */}
      <View style={[styles.totalBanner, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name="list-outline" size={18} color={colors.primary} />
        <Text style={[styles.totalText, { color: colors.primary }]}>
          서베이 토픽: {totalSurveySelected}개 선택 (최소 {SURVEY_CONFIG.TOTAL_MIN_SELECTIONS}개)
        </Text>
        {totalSurveySelected >= SURVEY_CONFIG.TOTAL_MIN_SELECTIONS && (
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        )}
      </View>

      {/* 그룹별 서베이 토픽 */}
      {groups.map((group) => {
        const groupTopics = groupedTopics.get(group.id) || [];
        if (groupTopics.length === 0) return null;

        const selCount = groupSelectionCount(group.id);
        const isSingle = group.selection_type === 'single';
        const meetsMin = isSingle ? selCount >= 1 : selCount >= group.min_selections;

        return (
          <View key={group.id} style={styles.groupSection}>
            {/* 그룹 헤더 */}
            <View style={styles.groupHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>
                  {group.name_ko}
                </Text>
                <Text style={[styles.groupRule, { color: colors.textSecondary }]}>
                  {isSingle
                    ? '1개 선택'
                    : `${group.min_selections}개 이상 선택`}
                  {' · '}
                  {selCount}개 선택됨
                </Text>
              </View>
              {meetsMin ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={colors.textDisabled} />
              )}
            </View>

            {/* 토픽 카드 그리드 */}
            <View style={styles.topicGrid}>
              {groupTopics.map((topic) => {
                const isSelected = selectedIds.has(topic.id);
                return (
                  <Pressable
                    key={topic.id}
                    style={[
                      styles.topicCard,
                      { backgroundColor: colors.surface },
                      isSelected && {
                        backgroundColor: colors.primaryLight,
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => onToggle(topic.id, group.id)}
                  >
                    {isSelected && (
                      <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: colors.borderLight },
                        isSelected && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Ionicons
                        name={
                          (topic.icon as keyof typeof Ionicons.glyphMap) ||
                          'document-text-outline'
                        }
                        size={20}
                        color={isSelected ? '#FFFFFF' : colors.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.topicName,
                        { color: colors.textPrimary },
                        isSelected && { color: colors.primary, fontFamily: 'Pretendard-SemiBold' },
                      ]}
                      numberOfLines={2}
                    >
                      {topic.name_ko}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* 자동 배정 토픽 안내 (자기소개 + 집/거주 + 이웃/동네) */}
      {autoAssignedTopics.length > 0 && (
        <View style={[styles.autoAssignBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.autoAssignText, { color: colors.textSecondary }]}>
            자동 배정: {autoAssignedTopics.map((t) => t.name_ko).join(', ')}
          </Text>
        </View>
      )}

      {/* 돌발 토픽 */}
      {showUnexpected && unexpectedTopics.length > 0 && (
        <View style={styles.groupSection}>
          <View style={styles.groupHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>돌발 주제</Text>
              <Text style={[styles.groupRule, { color: colors.textSecondary }]}>
                자유 선택 · {unexpectedTopics.filter((t) => selectedIds.has(t.id)).length}개 선택됨
              </Text>
            </View>
          </View>
          <View style={styles.topicGrid}>
            {unexpectedTopics.map((topic) => {
              const isSelected = selectedIds.has(topic.id);
              return (
                <Pressable
                  key={topic.id}
                  style={[
                    styles.topicCard,
                    { backgroundColor: colors.surface },
                    isSelected && {
                      backgroundColor: colors.primaryLight,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => onToggle(topic.id, null)}
                >
                  {isSelected && (
                    <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: colors.borderLight },
                      isSelected && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Ionicons
                      name={
                        (topic.icon as keyof typeof Ionicons.glyphMap) ||
                        'document-text-outline'
                      }
                      size={20}
                      color={isSelected ? '#FFFFFF' : colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.topicName,
                      { color: colors.textPrimary },
                      isSelected && { color: colors.primary, fontFamily: 'Pretendard-SemiBold' },
                    ]}
                    numberOfLines={2}
                  >
                    {topic.name_ko}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ============================================================================
// Hook: 그룹 기반 토픽 선택 로직
// ============================================================================

/**
 * 그룹 기반 토픽 토글 로직 (single 그룹은 1개만 허용)
 */
export function useTopicGroupToggle(
  groups: TopicGroup[],
  topics: TopicListItem[],
) {
  const groupMap = useMemo(() => {
    const map = new Map<string, TopicGroup>();
    for (const g of groups) map.set(g.id, g);
    return map;
  }, [groups]);

  const topicsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of topics) {
      if (t.group_id) {
        const arr = map.get(t.group_id) || [];
        arr.push(t.id);
        map.set(t.group_id, arr);
      }
    }
    return map;
  }, [topics]);

  const toggle = useCallback(
    (
      topicId: string,
      groupId: string | null,
      prev: Set<string>,
    ): Set<string> => {
      const next = new Set(prev);

      if (next.has(topicId)) {
        // 해제
        next.delete(topicId);
        return next;
      }

      // single 그룹: 같은 그룹 내 다른 토픽 해제
      if (groupId) {
        const group = groupMap.get(groupId);
        if (group?.selection_type === 'single') {
          const groupTopicIds = topicsByGroup.get(groupId) || [];
          for (const id of groupTopicIds) {
            next.delete(id);
          }
        }
      }

      next.add(topicId);
      return next;
    },
    [groupMap, topicsByGroup],
  );

  return { toggle };
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  profileSection: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  activitySectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 12,
  },
  totalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  totalText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  groupSection: {
    marginBottom: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupTitle: {
    fontSize: 15,
    fontFamily: 'Pretendard-Bold',
  },
  groupRule: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicCard: {
    width: '31%',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  topicName: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    textAlign: 'center',
  },
  autoAssignBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  autoAssignText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
  },
});
