import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { getTopics, TopicListItem } from '@/services/scripts';

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

      <FlatList
        data={allTopics}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selectedTopics.includes(item.id);
          return (
            <Pressable
              style={[styles.topicCard, isSelected && styles.topicCardSelected]}
              onPress={() => toggleTopic(item.id)}
            >
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={14} color={COLORS.WHITE} />
                </View>
              )}
              <Text style={styles.icon}>{item.icon || '📝'}</Text>
              <Text style={[styles.topicName, isSelected && styles.topicNameSelected]}>
                {item.name_ko}
              </Text>
              {item.name_en && (
                <Text style={styles.topicNameEn}>{item.name_en}</Text>
              )}
            </Pressable>
          );
        }}
      />

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
  topicCard: {
    flex: 1,
    margin: 4,
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
  icon: {
    fontSize: 32,
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
