import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, TOPIC_CATEGORY_LABELS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { getTopics, TopicListItem } from '@/services/scripts';
import type { TopicCategory } from '@/lib/types';

export default function TopicsScreen() {
  const [allTopics, setAllTopics] = useState<TopicListItem[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 토픽 목록 + 기존 선택 로드
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 토픽 목록
      const { data: topics } = await getTopics();
      if (topics) setAllTopics(topics);

      // 기존 선택된 토픽
      const { data: myTopics } = await supabase
        .from('student_topics')
        .select('topic_id')
        .eq('student_id', user.id)
        .is('deleted_at', null);

      if (myTopics) {
        setSelectedTopics(myTopics.map((t) => t.topic_id));
      }

      setIsLoading(false);
    };

    load();
  }, []);

  // 카테고리별 그룹핑
  const groupedTopics = useMemo(() => {
    const groups: { category: TopicCategory; label: string; topics: TopicListItem[] }[] = [];
    const categoryOrder: TopicCategory[] = ['survey', 'unexpected'];

    for (const cat of categoryOrder) {
      const filtered = allTopics.filter((t) => t.category === cat);
      if (filtered.length > 0) {
        groups.push({
          category: cat,
          label: TOPIC_CATEGORY_LABELS[cat],
          topics: filtered,
        });
      }
    }

    return groups;
  }, [allTopics]);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId]
    );
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsSaving(true);

    // 기존 선택 soft delete
    const { error: deleteError } = await supabase
      .from('student_topics')
      .update({ deleted_at: new Date().toISOString() })
      .eq('student_id', user.id)
      .is('deleted_at', null);

    if (deleteError) {
      Alert.alert('오류', '토픽 저장에 실패했습니다.');
      setIsSaving(false);
      return;
    }

    // 새 선택 insert
    if (selectedTopics.length > 0) {
      const inserts = selectedTopics.map((topicId) => ({
        student_id: user.id,
        topic_id: topicId,
      }));

      const { error } = await supabase.from('student_topics').insert(inserts);

      if (error) {
        Alert.alert('오류', '토픽 저장에 실패했습니다.');
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    Alert.alert('완료', '토픽이 저장되었습니다.', [
      { text: '확인', onPress: () => router.back() },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        Background Survey에서 선택한 토픽을 설정하세요.
      </Text>
      <Text style={styles.selectedCount}>
        {selectedTopics.length}개 선택됨
      </Text>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {groupedTopics.map((group) => (
          <View key={group.category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{group.label} ({group.topics.length})</Text>
            <View style={styles.topicGrid}>
              {group.topics.map((item) => {
                const isSelected = selectedTopics.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.topicCard, isSelected && styles.topicCardSelected]}
                    onPress={() => toggleTopic(item.id)}
                  >
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={14} color={COLORS.WHITE} />
                      </View>
                    )}
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name={
                          (item.icon as keyof typeof Ionicons.glyphMap) ||
                          'document-text-outline'
                        }
                        size={24}
                        color={isSelected ? COLORS.PRIMARY : COLORS.GRAY_500}
                      />
                    </View>
                    <Text style={[styles.topicName, isSelected && styles.topicNameSelected]}>
                      {item.name_ko}
                    </Text>
                    {item.name_en && (
                      <Text style={styles.topicNameEn}>{item.name_en}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color={COLORS.WHITE} size="small" />
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
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
    marginBottom: 4,
  },
  selectedCount: {
    fontSize: 13,
    color: COLORS.PRIMARY,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 10,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicCard: {
    width: '48%',
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  topicCardSelected: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderColor: COLORS.PRIMARY,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.GRAY_100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicName: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  topicNameSelected: {
    color: COLORS.PRIMARY,
  },
  topicNameEn: {
    fontSize: 11,
    color: COLORS.GRAY_400,
    marginTop: 2,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: COLORS.PRIMARY,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.WHITE,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
});
