import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import type { StudentTopicWithProgress } from '@/lib/types';

interface TopicProgressCardProps {
  topic: StudentTopicWithProgress;
  onPress: () => void;
}

export function TopicProgressCard({ topic, onPress }: TopicProgressCardProps) {
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
          size={20}
          color={COLORS.PRIMARY}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.topicName} numberOfLines={1}>
          {topic.topic_name_ko}
        </Text>

        {/* 진행률 바 + 통계를 한 줄로 */}
        <View style={styles.bottomRow}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(progress * 100, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.statText}>
            {topic.scripts_count}/{topic.total_questions}
            {topic.practices_count > 0 ? ` · ${topic.practices_count}회` : ''}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={COLORS.GRAY_300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  topicName: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.GRAY_100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 2,
  },
  statText: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.GRAY_400,
    minWidth: 50,
    textAlign: 'right',
  },
});
