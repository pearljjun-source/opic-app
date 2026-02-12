import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import type { StudentTopicWithProgress } from '@/lib/types';

interface TopicCardProps {
  topic: StudentTopicWithProgress;
  onPress: () => void;
}

export function TopicCard({ topic, onPress }: TopicCardProps) {
  const progress =
    topic.total_questions > 0
      ? topic.scripts_count / topic.total_questions
      : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={(topic.topic_icon as keyof typeof Ionicons.glyphMap) || 'document-text-outline'}
          size={24}
          color={COLORS.PRIMARY}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.topicName} numberOfLines={1}>
          {topic.topic_name_ko}
        </Text>

        {/* 진행률 바 */}
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(progress * 100, 100)}%` },
            ]}
          />
        </View>

        <Text style={styles.progressLabel}>
          {topic.scripts_count}/{topic.total_questions} 준비됨
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={COLORS.GRAY_300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.BLACK,
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
    backgroundColor: COLORS.PRIMARY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  topicName: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: COLORS.GRAY_100,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.GRAY_400,
  },
});
