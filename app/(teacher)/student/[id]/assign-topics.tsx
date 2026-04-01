import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

import { SurveyProfileSelector } from '@/components/SurveyProfileSelector';
import { TopicGroupSelector, useTopicGroupToggle } from '@/components/TopicGroupSelector';
import { SURVEY_CONFIG, TOPIC_CATEGORIES, DEFAULT_SURVEY_PROFILE } from '@/lib/constants';
import { getTopics, type TopicListItem } from '@/services/scripts';
import {
  getTopicGroups,
  setStudentTopics,
  getStudentTopicsWithProgress,
  getSurveyProfile,
  saveSurveyProfile,
} from '@/services/topics';
import { getUserMessage } from '@/lib/errors';
import { alert as xAlert } from '@/lib/alert';
import type { TopicGroup, SurveyProfile } from '@/lib/types';
import { useThemeColors } from '@/hooks/useTheme';

export default function AssignTopicsScreen() {
  const colors = useThemeColors();
  const { id: studentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [groups, setGroups] = useState<TopicGroup[]>([]);
  const [allTopics, setAllTopics] = useState<TopicListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<SurveyProfile>(DEFAULT_SURVEY_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toggle } = useTopicGroupToggle(groups, allTopics);

  useEffect(() => {
    const load = async () => {
      if (!studentId) return;
      setIsLoading(true);

      const [groupsResult, topicsResult, assignedResult, profileResult] = await Promise.all([
        getTopicGroups(),
        getTopics(),
        getStudentTopicsWithProgress(studentId),
        getSurveyProfile(studentId),
      ]);

      if (groupsResult.data) setGroups(groupsResult.data);

      if (topicsResult.error) {
        setError(getUserMessage(topicsResult.error));
      } else {
        const activeTopics = topicsResult.data || [];
        setAllTopics(activeTopics);

        if (assignedResult.data) {
          // active 토픽만 유지 + 자동 배정 토픽 제외 (서버가 자동 추가)
          const activeIds = new Set(activeTopics.map((t) => t.id));
          const autoIds = new Set(activeTopics.filter((t) => t.is_auto_assigned).map((t) => t.id));
          setSelectedIds(
            new Set(assignedResult.data.map((t) => t.topic_id).filter((id) => activeIds.has(id) && !autoIds.has(id))),
          );
        }
      }

      if (profileResult.data) setProfile(profileResult.data);

      setIsLoading(false);
    };

    load();
  }, [studentId]);

  const handleToggle = useCallback(
    (topicId: string, groupId: string | null) => {
      setSelectedIds((prev) => toggle(topicId, groupId, prev));
    },
    [toggle],
  );

  const handleSave = async () => {
    if (!studentId) return;

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

    setIsSaving(true);

    const [profileResult, topicsResult] = await Promise.all([
      saveSurveyProfile(studentId, profile),
      setStudentTopics(studentId, Array.from(selectedIds)),
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

    router.back();
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>토픽 불러오는 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '토픽 배정', headerBackTitle: '뒤로' }} />

      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          학생에게 배정할 서베이 프로필과 토픽을 선택하세요
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
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>저장하기</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  saveButton: {
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
  },
});
