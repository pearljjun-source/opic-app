import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import type { StudentTopicWithProgress } from '@/lib/types';

interface TopicProgressCardProps {
  topic: StudentTopicWithProgress;
  onPress: () => void;
}

export function TopicProgressCard({ topic, onPress }: TopicProgressCardProps) {
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
          size={20}
          color={colors.primary}
        />
      </View>

      <View style={styles.content}>
        <Text style={[styles.topicName, { color: colors.textPrimary }]} numberOfLines={1}>
          {topic.topic_name_ko}
        </Text>

        {/* 진행률 바 + 통계를 한 줄로 */}
        <View style={styles.bottomRow}>
          <View style={[styles.progressBarBg, { backgroundColor: colors.borderLight }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <Text style={[styles.statText, { color: colors.gray400 }]}>
            {topic.scripts_count}/{topic.total_questions}
            {topic.practices_count > 0 ? ` · ${topic.practices_count}회` : ''}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.gray300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
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
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  statText: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    minWidth: 50,
    textAlign: 'right',
  },
});
