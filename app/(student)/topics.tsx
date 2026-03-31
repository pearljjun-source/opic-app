import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';

import { useThemeColors } from '@/hooks/useTheme';
import { SkeletonList } from '@/components/ui/Loading';
import { TopicGroupSelector, useTopicGroupToggle } from '@/components/TopicGroupSelector';
import { SURVEY_CONFIG, TOPIC_CATEGORIES } from '@/lib/constants';
import { getTopics } from '@/services/scripts';
import { getTopicGroups, setStudentTopics } from '@/services/topics';
import { getUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import type { TopicGroup } from '@/lib/types';
import type { TopicListItem } from '@/services/scripts';

export default function TopicsScreen() {
  const colors = useThemeColors();
  const [groups, setGroups] = useState<TopicGroup[]>([]);
  const [allTopics, setAllTopics] = useState<TopicListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { toggle } = useTopicGroupToggle(groups, allTopics);

  // 토픽 그룹 + 토픽 목록 + 기존 선택 로드
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [groupsResult, topicsResult, myTopicsResult] = await Promise.all([
        getTopicGroups(),
        getTopics(),
        supabase
          .from('student_topics')
          .select('topic_id')
          .eq('student_id', user.id),
      ]);

      if (groupsResult.data) setGroups(groupsResult.data);
      if (topicsResult.data) setAllTopics(topicsResult.data);
      if (myTopicsResult.data) {
        setSelectedIds(new Set(myTopicsResult.data.map((t) => t.topic_id)));
      }

      setIsLoading(false);
    };

    load();
  }, []);

  const handleToggle = useCallback(
    (topicId: string, groupId: string | null) => {
      setSelectedIds((prev) => toggle(topicId, groupId, prev));
    },
    [toggle],
  );

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 서베이 토픽 최소 선택 검증
    const surveyCount = allTopics.filter(
      (t) => t.category === TOPIC_CATEGORIES.SURVEY && selectedIds.has(t.id),
    ).length;

    if (surveyCount < SURVEY_CONFIG.TOTAL_MIN_SELECTIONS) {
      Alert.alert(
        '토픽 선택',
        `서베이 토픽을 최소 ${SURVEY_CONFIG.TOTAL_MIN_SELECTIONS}개 이상 선택해주세요. (현재 ${surveyCount}개)`,
      );
      return;
    }

    setIsSaving(true);

    // RPC 호출 (서버에서 유효성 검증)
    const { error: saveError } = await setStudentTopics(
      user.id,
      Array.from(selectedIds),
    );

    if (saveError) {
      Alert.alert('오류', getUserMessage(saveError));
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    showToast('토픽이 저장되었습니다.');
    router.back();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <SkeletonList count={4} style={{ padding: 16 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        실제 OPIc Background Survey 기준으로 토픽을 선택하세요.
      </Text>

      <TopicGroupSelector
        groups={groups}
        topics={allTopics}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        showUnexpected={true}
      />

      <Pressable
        style={[styles.saveButton, { backgroundColor: colors.primary }, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.saveButtonText}>저장</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingHorizontal: 0,
    paddingTop: 16,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  saveButton: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
});
