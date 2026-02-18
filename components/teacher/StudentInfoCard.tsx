import { View, Text, StyleSheet } from 'react-native';

import { useThemeColors } from '@/hooks/useTheme';
import { estimateOpicLevel, getOpicGradeColor } from '@/lib/helpers';
import type { StudentDetailInfo, StudentDetailStats } from '@/lib/types';

interface StudentInfoCardProps {
  student: StudentDetailInfo;
  stats: StudentDetailStats;
}

/**
 * StudentInfoCard - 학생 상세 정보 카드
 *
 * 기능:
 * - 학생 이름, 이메일 표시
 * - 연결 일시 표시
 * - 종합 통계 표시 (스크립트, 연습, 평균점수, 재현율)
 */
export function StudentInfoCard({ student, stats }: StudentInfoCardProps) {
  const colors = useThemeColors();

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatLastPractice = (lastPracticeAt: string | null): string => {
    if (!lastPracticeAt) return '없음';

    const date = new Date(lastPracticeAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    return `${Math.floor(diffDays / 30)}개월 전`;
  };

  const formatScore = (score: number | null): string => {
    if (score === null) return '-';
    return `${score}점`;
  };

  const formatRate = (rate: number | null): string => {
    if (rate === null) return '-';
    return `${rate}%`;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}시간`;
    return `${hours}시간 ${mins}분`;
  };

  const estimated = estimateOpicLevel(stats.avg_score);
  const gradeColor = getOpicGradeColor(estimated.grade);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }]}>
      {/* 학생 기본 정보 */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {student.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.textPrimary }]}>{student.name}</Text>
            <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
              <Text style={styles.gradeBadgeText}>{estimated.label}</Text>
            </View>
          </View>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{student.email}</Text>
          <Text style={[styles.connectedDate, { color: colors.textSecondary }]}>
            연결일: {formatDate(stats.connected_at)}
          </Text>
        </View>
      </View>

      {/* 통계 섹션 */}
      <View style={[styles.statsContainer, { borderTopColor: colors.border }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.scripts_count}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>스크립트</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.practices_count}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>연습</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatScore(stats.avg_score)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>평균점수</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {formatRate(stats.avg_reproduction_rate)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>재현율</Text>
          </View>
        </View>
      </View>

      {/* 추가 정보 (컴팩트 1줄) */}
      <View style={[styles.additionalInfo, { borderTopColor: colors.border }]}>
        <Text style={[styles.infoCompact, { color: colors.textSecondary }]}>
          이번 주 {stats.this_week_practices}회 · 총 {formatDuration(stats.total_duration_minutes)} · 마지막 {formatLastPractice(stats.last_practice_at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    fontSize: 20,
    fontFamily: 'Pretendard-SemiBold',
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gradeBadgeText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
  },
  email: {
    fontSize: 14,
    marginBottom: 4,
  },
  connectedDate: {
    fontSize: 12,
  },
  statsContainer: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  additionalInfo: {
    paddingTop: 10,
    borderTopWidth: 1,
  },
  infoCompact: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
  },
});

export default StudentInfoCard;
