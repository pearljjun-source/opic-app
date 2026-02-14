import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import type { TeacherDashboardStats } from '@/lib/types';

interface DashboardStatsProps {
  stats: TeacherDashboardStats;
}

interface StatCardData {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  value: string;
  label: string;
}

/**
 * DashboardStats - 강사 대시보드 상단 요약 통계 카드
 *
 * 4개 지표: 학생 수, 이번주 연습, 피드백 대기, 평균 점수
 * 2x2 그리드 레이아웃
 */
export function DashboardStats({ stats }: DashboardStatsProps) {
  const cards: StatCardData[] = [
    {
      icon: 'people-outline',
      iconColor: COLORS.PRIMARY,
      iconBg: COLORS.PRIMARY_LIGHT,
      value: `${stats.totalStudents}명`,
      label: '학생',
    },
    {
      icon: 'document-text-outline',
      iconColor: COLORS.INFO,
      iconBg: COLORS.PRIMARY_LIGHT,
      value: `${stats.thisWeekPractices}회`,
      label: '이번주 연습',
    },
    {
      icon: 'chatbubble-ellipses-outline',
      iconColor: COLORS.SECONDARY,
      iconBg: COLORS.SECONDARY_LIGHT,
      value: `${stats.pendingFeedbacks}건`,
      label: '피드백 대기',
    },
    {
      icon: 'stats-chart-outline',
      iconColor: COLORS.SUCCESS,
      iconBg: COLORS.GRAY_50,
      value: stats.avgScore !== null ? `${stats.avgScore}점` : '-',
      label: '평균 점수',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {cards.slice(0, 2).map((card) => (
          <View key={card.label} style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: card.iconBg }]}>
              <Ionicons name={card.icon} size={20} color={card.iconColor} />
            </View>
            <Text style={styles.value}>{card.value}</Text>
            <Text style={styles.label}>{card.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        {cards.slice(2, 4).map((card) => (
          <View key={card.label} style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: card.iconBg }]}>
              <Ionicons name={card.icon} size={20} color={card.iconColor} />
            </View>
            <Text style={styles.value}>{card.value}</Text>
            <Text style={styles.label}>{card.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 14,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  value: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
  },
});
