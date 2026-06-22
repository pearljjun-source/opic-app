import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { QUESTION_TYPE_LABELS } from '@/lib/constants';
import type { WeakAreas } from '@/services/practices';

interface WeakAreasCardProps {
  weakAreas: WeakAreas;
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

export function WeakAreasCard({ weakAreas }: WeakAreasCardProps) {
  const colors = useThemeColors();
  const { weak_topics, weak_question_types, unpracticed_topics } = weakAreas;

  // 데이터가 전혀 없으면 표시하지 않음
  if (weak_topics.length === 0 && unpracticed_topics.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }]}>
      <View style={styles.header}>
        <Ionicons name="analytics-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>집중 연습 추천</Text>
      </View>

      {/* 약점 토픽 */}
      {weak_topics.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>점수가 낮은 토픽</Text>
          {weak_topics.map((topic) => (
            <Pressable
              key={topic.topic_id}
              style={({ pressed }) => [
                styles.topicRow,
                { backgroundColor: pressed ? colors.borderLight : 'transparent' },
              ]}
              onPress={() => router.push({
                pathname: '/(student)/topic/[topicId]' as any,
                params: { topicId: topic.topic_id, topicName: topic.topic_name_ko },
              })}
            >
              <View style={styles.topicInfo}>
                <Text style={[styles.topicName, { color: colors.textPrimary }]}>{topic.topic_name_ko}</Text>
                <Text style={[styles.topicMeta, { color: colors.textSecondary }]}>
                  {topic.practice_count}회 연습
                </Text>
              </View>
              <View style={styles.scoreContainer}>
                <Text style={[styles.scoreText, { color: getScoreColor(topic.avg_score) }]}>
                  {topic.avg_score}점
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* 약점 질문 유형 */}
      {weak_question_types.length > 1 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>질문 유형별 점수</Text>
          <View style={styles.typesGrid}>
            {weak_question_types.map((qt) => {
              const label = QUESTION_TYPE_LABELS[qt.question_type as keyof typeof QUESTION_TYPE_LABELS] || qt.question_type;
              const scoreColor = getScoreColor(qt.avg_score);
              return (
                <View key={qt.question_type} style={[styles.typeChip, { borderColor: scoreColor + '40' }]}>
                  <Text style={[styles.typeLabel, { color: colors.textPrimary }]}>{label}</Text>
                  <Text style={[styles.typeScore, { color: scoreColor }]}>{qt.avg_score}점</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 미연습 토픽 */}
      {unpracticed_topics.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>아직 연습하지 않은 토픽</Text>
          <View style={styles.unpracticedRow}>
            {unpracticed_topics.slice(0, 3).map((topic) => (
              <Pressable
                key={topic.topic_id}
                style={[styles.unpracticedChip, { backgroundColor: colors.warning + '15' }]}
                onPress={() => router.push({
                  pathname: '/(student)/topic/[topicId]' as any,
                  params: { topicId: topic.topic_id, topicName: topic.topic_name_ko },
                })}
              >
                <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
                <Text style={[styles.unpracticedText, { color: colors.warning }]}>{topic.topic_name_ko}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 8,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  topicInfo: {
    flex: 1,
  },
  topicName: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  topicMeta: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Bold',
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
  typeScore: {
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
    marginTop: 2,
  },
  unpracticedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unpracticedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unpracticedText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
});
