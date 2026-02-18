import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import type { TeacherDashboardStats } from '@/lib/types';

// Android LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TeacherCompactStatsStripProps {
  stats: TeacherDashboardStats;
}

/**
 * TeacherCompactStatsStrip - 강사 대시보드 컴팩트 통계 스트립
 *
 * 접힌 상태: 1줄 가로 배치 — 학생 수 | 이번주 연습 | 피드백 대기 | ▼
 * 펼친 상태: 하나의 카드 안에 4개 지표를 가로 1열로 배치
 */
export function TeacherCompactStatsStrip({ stats }: TeacherCompactStatsStripProps) {
  const colors = useThemeColors();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, shadowColor: '#000000' },
          pressed && styles.cardPressed,
        ]}
        onPress={toggleExpand}
      >
        {/* 접힌 상태: 가로 1줄 요약 */}
        <View style={styles.strip}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={14} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.totalStudents}명</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.statItem}>
            <Ionicons name="document-text" size={14} color={colors.info} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>이번주 {stats.thisWeekPractices}회</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.statItem}>
            <Ionicons name="chatbubble-ellipses" size={14} color={colors.secondary} />
            <Text style={[
              styles.statValue,
              { color: colors.textPrimary },
              stats.pendingFeedbacks > 0 && { color: colors.secondary },
            ]}>
              피드백 {stats.pendingFeedbacks}건
            </Text>
          </View>

          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
            style={styles.chevron}
          />
        </View>

        {/* 펼친 상태: 같은 카드 안에 가로 4열 상세 */}
        {isExpanded && (
          <>
            <View style={[styles.expandDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.expandedRow}>
              <View style={styles.expandedItem}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="people-outline" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.expandedValue, { color: colors.textPrimary }]}>{stats.totalStudents}명</Text>
                <Text style={[styles.expandedLabel, { color: colors.textSecondary }]}>학생</Text>
              </View>

              <View style={styles.expandedItem}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="document-text-outline" size={18} color={colors.info} />
                </View>
                <Text style={[styles.expandedValue, { color: colors.textPrimary }]}>{stats.thisWeekPractices}회</Text>
                <Text style={[styles.expandedLabel, { color: colors.textSecondary }]}>이번주 연습</Text>
              </View>

              <View style={styles.expandedItem}>
                <View style={[styles.iconCircle, { backgroundColor: colors.secondaryLight }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.secondary} />
                </View>
                <Text style={[styles.expandedValue, { color: colors.textPrimary }]}>{stats.pendingFeedbacks}건</Text>
                <Text style={[styles.expandedLabel, { color: colors.textSecondary }]}>피드백 대기</Text>
              </View>

              <View style={styles.expandedItem}>
                <View style={[styles.iconCircle, { backgroundColor: colors.borderLight }]}>
                  <Ionicons name="stats-chart-outline" size={18} color={colors.success} />
                </View>
                <Text style={[styles.expandedValue, { color: colors.textPrimary }]}>
                  {stats.avgScore !== null ? `${stats.avgScore}점` : '-'}
                </Text>
                <Text style={[styles.expandedLabel, { color: colors.textSecondary }]}>평균 점수</Text>
              </View>
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  // 접힌 상태 가로 1줄
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  divider: {
    width: 1,
    height: 16,
    marginHorizontal: 10,
  },
  chevron: {
    marginLeft: 'auto',
  },
  // 펼친 상태 구분선 + 가로 4열
  expandDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  expandedRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  expandedItem: {
    flex: 1,
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  expandedValue: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 2,
  },
  expandedLabel: {
    fontSize: 10,
    fontFamily: 'Pretendard-Regular',
  },
});
