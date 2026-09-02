import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';

import { useThemeColors } from '@/hooks/useTheme';
import { SkeletonList } from '@/components/ui/Loading';
import { SurveyProfileSelector } from '@/components/SurveyProfileSelector';
import { TopicGroupSelector, useTopicGroupToggle } from '@/components/TopicGroupSelector';
import { SURVEY_CONFIG, TOPIC_CATEGORIES, DEFAULT_SURVEY_PROFILE } from '@/lib/constants';
import { getTopics } from '@/services/scripts';
import {
  getTopicGroups,
  setStudentTopics,
  getSurveyProfile,
  saveSurveyProfile,
  getStudentTopicScriptCounts,
} from '@/services/topics';
import { getUserMessage } from '@/lib/errors';
import { alert as xAlert, confirm } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import type { TopicGroup, SurveyProfile } from '@/lib/types';
import type { TopicListItem } from '@/services/scripts';

export default function TopicsScreen() {
  const colors = useThemeColors();
  const [groups, setGroups] = useState<TopicGroup[]>([]);
  const [allTopics, setAllTopics] = useState<TopicListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<SurveyProfile>(DEFAULT_SURVEY_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [scriptCounts, setScriptCounts] = useState<Record<string, number>>({});

  const { toggle } = useTopicGroupToggle(groups, allTopics);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [groupsResult, topicsResult, myTopicsResult, profileResult, countsResult] = await Promise.all([
        getTopicGroups(),
        getTopics(),
        supabase
          .from('student_topics')
          .select('topic_id')
          .eq('student_id', user.id),
        getSurveyProfile(user.id),
        getStudentTopicScriptCounts(user.id),
      ]);

      setScriptCounts(countsResult.data);

      if (groupsResult.data) setGroups(groupsResult.data);
      if (topicsResult.data) setAllTopics(topicsResult.data);
      if (myTopicsResult.data) {
        // active 토픽 ID만 유지 + 자동 배정 토픽 제외 (서버가 자동 추가)
        const activeTopics = topicsResult.data || [];
        const activeIds = new Set(activeTopics.map((t) => t.id));
        const autoIds = new Set(activeTopics.filter((t) => t.is_auto_assigned).map((t) => t.id));
        setSelectedIds(
          new Set(myTopicsResult.data.map((t) => t.topic_id).filter((id) => activeIds.has(id) && !autoIds.has(id))),
        );
      }
      if (profileResult.data) setProfile(profileResult.data);

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

    // 서베이 토픽 최소 선택 검증 (자동 배정 제외)
    const surveyCount = allTopics.filter(
      (t) => t.category === TOPIC_CATEGORIES.SURVEY && !t.is_auto_assigned && selectedIds.has(t.id),
    ).length;

    if (surveyCount < SURVEY_CONFIG.TOTAL_MIN_SELECTIONS) {
      xAlert(
        '토픽 선택',
        `서베이 토픽을 최소 ${SURVEY_CONFIG.TOTAL_MIN_SELECTIONS}개 이상 선택해주세요. (현재 ${surveyCount}개)`,
      );
      return;
    }

    // 스크립트가 있는 토픽을 해제한 경우 경고
    const dropped = allTopics.filter(
      (t) => !t.is_auto_assigned && !selectedIds.has(t.id) && (scriptCounts[t.id] ?? 0) > 0,
    );

    if (dropped.length > 0) {
      const detail = dropped
        .map((t) => `· ${t.name_ko} (스크립트 ${scriptCounts[t.id]}개)`)
        .join('\n');
      confirm(
        '선택 해제된 토픽 확인',
        `아래 토픽은 강사님이 작성한 스크립트가 있어요.\n\n${detail}\n\n해제해도 스크립트는 "스크립트 보관"으로 계속 볼 수 있지만, 학습 목록에서는 뒤로 밀립니다. 저장할까요?`,
        () => { void doSave(user.id); },
      );
      return;
    }

    await doSave(user.id);
  };

  const doSave = async (userId: string) => {
    setIsSaving(true);

    // 프로필 + 토픽 동시 저장
    const [profileResult, topicsResult] = await Promise.all([
      saveSurveyProfile(userId, profile),
      setStudentTopics(userId, Array.from(selectedIds)),
    ]);

    if (profileResult.error) {
      xAlert('오류', getUserMessage(profileResult.error));
      setIsSaving(false);
      return;
    }

    if (topicsResult.error) {
      xAlert('오류', topicsResult.error.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    showToast('서베이가 저장되었습니다.');
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
        실제 OPIc Background Survey와 동일한 구조입니다.
      </Text>

      <TopicGroupSelector
        groups={groups}
        topics={allTopics}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        showUnexpected={true}
        profileSection={
          <SurveyProfileSelector profile={profile} onChange={setProfile} />
        }
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
