import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import type { StudentTopicWithProgress } from '@/lib/types';

interface TopicCardProps {
  topic: StudentTopicWithProgress;
  onPress: () => void;
}

export function TopicCard({ topic, onPress }: TopicCardProps) {
  const colors = useThemeColors();

  const progress =
    topic.total_questions > 0
      ? topic.scripts_count / topic.total_questions
      : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, shadowColor: '#000000' }, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
        <Ionicons
          name={(topic.topic_icon as keyof typeof Ionicons.glyphMap) || 'document-text-outline'}
          size={24}
          color={colors.primary}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.topicName, { color: colors.textPrimary }]} numberOfLines={1}>
            {topic.topic_name_ko}
          </Text>
          {/* 배정이 풀렸지만 스크립트가 남아있는 토픽 */}
          {topic.is_assigned === false && (
            <View style={[styles.archivedBadge, { backgroundColor: colors.borderLight }]}>
              <Ionicons name="archive-outline" size={11} color={colors.gray400} />
              <Text style={[styles.archivedText, { color: colors.gray400 }]}>스크립트 보관</Text>
            </View>
          )}
        </View>

        {/* 진행률 바 */}
        <View style={[styles.progressBarBg, { backgroundColor: colors.borderLight }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>

        <Text style={[styles.progressLabel, { color: colors.gray400 }]}>
          {topic.scripts_count}/{topic.total_questions} 준비됨
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.gray300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  topicName: {
    flexShrink: 1,
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  archivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  archivedText: {
    fontSize: 10,
    fontFamily: 'Pretendard-Medium',
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
  },
});
