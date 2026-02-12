import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '@/lib/constants';
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

  return (
    <View style={styles.container}>
      {/* 학생 기본 정보 */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {student.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{student.name}</Text>
          <Text style={styles.email}>{student.email}</Text>
          <Text style={styles.connectedDate}>
            연결일: {formatDate(stats.connected_at)}
          </Text>
        </View>
      </View>

      {/* 통계 섹션 */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.scripts_count}</Text>
            <Text style={styles.statLabel}>스크립트</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.practices_count}</Text>
            <Text style={styles.statLabel}>연습</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatScore(stats.avg_score)}</Text>
            <Text style={styles.statLabel}>평균점수</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatRate(stats.avg_reproduction_rate)}
            </Text>
            <Text style={styles.statLabel}>재현율</Text>
          </View>
        </View>
      </View>

      {/* 추가 정보 */}
      <View style={styles.additionalInfo}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>이번 주 연습</Text>
          <Text style={styles.infoValue}>{stats.this_week_practices}회</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>총 연습 시간</Text>
          <Text style={styles.infoValue}>
            {formatDuration(stats.total_duration_minutes)}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>마지막 연습</Text>
          <Text style={styles.infoValue}>
            {formatLastPractice(stats.last_practice_at)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: COLORS.BLACK,
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
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  connectedDate: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  statsContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
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
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.BORDER,
  },
  additionalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.PRIMARY,
  },
});

export default StudentInfoCard;
