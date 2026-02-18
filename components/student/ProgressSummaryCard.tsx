import { View, Text, StyleSheet } from 'react-native';

import { STUDENT_GOALS } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';
import { estimateOpicLevel, getOpicGradeProgress, getOpicGradeColor } from '@/lib/helpers';
import type { StudentPracticeStats, OpicGrade } from '@/lib/types';

interface ProgressSummaryCardProps {
  stats: StudentPracticeStats;
  /** 부모 컨테이너 내부에서 사용 시 외부 여백/그림자 제거 */
  embedded?: boolean;
}

/**
 * ProgressSummaryCard - 학생 대시보드 진도 요약 카드
 *
 * 표시 항목:
 * - 현재 추정 OPIc 등급
 * - 목표 등급까지 진행률 바
 * - 이번 주 연습 횟수 / 목표
 */
export function ProgressSummaryCard({ stats, embedded }: ProgressSummaryCardProps) {
  const colors = useThemeColors();

  const estimated = estimateOpicLevel(stats.avg_score);
  const targetGrade = stats.target_opic_grade as OpicGrade | null;
  const progress = getOpicGradeProgress(estimated.grade, targetGrade);
  const gradeColor = getOpicGradeColor(estimated.grade);

  const weeklyGoal = STUDENT_GOALS.WEEKLY_PRACTICES;
  const weeklyProgress = Math.min(
    (stats.this_week_practices / weeklyGoal) * 100,
    100
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }, embedded && styles.embedded]}>
      {/* 등급 섹션 */}
      <View style={styles.gradeSection}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>현재 추정 등급</Text>
        <View style={styles.gradeRow}>
          <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
            <Text style={styles.gradeText}>{estimated.grade}</Text>
          </View>
          {targetGrade && (
            <Text style={[styles.targetText, { color: colors.textSecondary }]}>
              목표: {targetGrade}
            </Text>
          )}
        </View>

        {/* 목표 진행률 바 */}
        {targetGrade && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBarBg, { backgroundColor: colors.borderLight }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress}%`, backgroundColor: gradeColor },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>{progress}%</Text>
          </View>
        )}
      </View>

      {/* 구분선 */}
      <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

      {/* 주간 연습 섹션 */}
      <View style={styles.weeklySection}>
        <View style={styles.weeklyHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>이번 주 연습</Text>
          <Text style={[styles.weeklyCount, { color: colors.textSecondary }]}>
            <Text style={[styles.weeklyCountBold, { color: colors.textPrimary }]}>{stats.this_week_practices}</Text>
            /{weeklyGoal}회
          </Text>
        </View>
        <View style={[styles.progressBarBg, { backgroundColor: colors.borderLight }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${weeklyProgress}%`,
                backgroundColor: weeklyProgress >= 100 ? colors.success : colors.primary,
              },
            ]}
          />
        </View>
        {weeklyProgress >= 100 && (
          <Text style={[styles.completedText, { color: colors.success }]}>이번 주 목표 달성!</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  embedded: {
    marginHorizontal: 0,
    marginBottom: 8,
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  gradeSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 8,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gradeText: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
  },
  targetText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    marginLeft: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    width: 36,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  weeklySection: {},
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weeklyCount: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },
  weeklyCountBold: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
  },
  completedText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    marginTop: 4,
  },
});
