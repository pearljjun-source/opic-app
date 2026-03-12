import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { EXAM_TYPE_LABELS, COLORS } from '@/lib/constants';
import { getMyExamSessions } from '@/services/exams';
import { getUserMessage } from '@/lib/errors';
import { alert as xAlert } from '@/lib/alert';
import type { ExamSessionListItem, ExamType } from '@/lib/types';

const FILTER_OPTIONS: Array<{ label: string; value: ExamType | 'all' }> = [
  { label: '전체', value: 'all' },
  { label: '모의고사', value: 'mock_exam' },
  { label: '롤플레이', value: 'combo_roleplay' },
  { label: '레벨테스트', value: 'level_test' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: '완료', color: COLORS.SUCCESS },
  in_progress: { label: '진행 중', color: COLORS.WARNING },
  abandoned: { label: '포기', color: COLORS.GRAY_400 },
};

export default function ExamHistoryScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const [sessions, setSessions] = useState<ExamSessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ExamType | 'all'>('all');

  useEffect(() => {
    loadSessions();
  }, [filter]);

  const loadSessions = async () => {
    setIsLoading(true);
    const { data, error } = await getMyExamSessions(filter === 'all' ? undefined : filter);
    if (error) {
      xAlert('오류', getUserMessage(error));
    } else {
      setSessions(data);
    }
    setIsLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDuration = (sec: number | null | undefined) => {
    if (sec == null) return '-';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}분 ${s}초`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* 필터 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((opt) => {
          const isActive = filter === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[
                styles.filterChip,
                { backgroundColor: isActive ? colors.primary : colors.surface, borderColor: colors.border },
                !isActive && { borderWidth: 1 },
              ]}
              onPress={() => setFilter(opt.value)}
            >
              <Text style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : colors.textSecondary }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={48} color={colors.textDisabled} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>시험 기록이 없습니다.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {sessions.map((session) => {
            const statusInfo = STATUS_LABELS[session.status] || STATUS_LABELS.completed;
            return (
              <Pressable
                key={session.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push(routes.sessionDetail(session.id) as any)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleArea}>
                    <Text style={[styles.cardType, { color: colors.textPrimary }]}>
                      {EXAM_TYPE_LABELS[session.exam_type]}
                    </Text>
                    <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                      {formatDate(session.started_at)}
                    </Text>
                  </View>
                  {session.estimated_grade ? (
                    <View style={[styles.gradeBadge, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.gradeText, { color: colors.primary }]}>{session.estimated_grade}</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardBottom}>
                  {session.overall_score != null && (
                    <View style={styles.metaItem}>
                      <Ionicons name="star-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>{session.overall_score}점</Text>
                    </View>
                  )}
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {formatDuration(session.total_duration_sec)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  filterRow: { paddingHorizontal: 24, paddingVertical: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipText: { fontSize: 13, fontFamily: 'Pretendard-Medium' },
  listContent: { paddingHorizontal: 24, paddingBottom: 48 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleArea: { flex: 1 },
  cardType: { fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
  cardDate: { fontSize: 12, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  gradeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gradeText: { fontSize: 15, fontFamily: 'Pretendard-Bold' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 12, fontFamily: 'Pretendard-Medium' },
  cardBottom: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontFamily: 'Pretendard-Regular' },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Regular' },
});
