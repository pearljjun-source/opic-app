import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { SkeletonList } from '@/components/ui/Loading';
import { getMyPractices, deletePractice } from '@/services/practices';
import { getUserMessage } from '@/lib/errors';
import { queryKeys, unwrap } from '@/lib/query';
import { confirm as xConfirm, alert as xAlert } from '@/lib/alert';
import { showToast } from '@/lib/toast';
import { TEST_IDS } from '@/lib/testIds';

interface PracticeItem {
  id: string;
  score: number | null;
  reproduction_rate: number | null;
  duration: number | null;
  created_at: string;
  question_text: string;
  topic_name_ko: string;
}

export default function HistoryScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();

  const {
    data: practices = [],
    // isPending 는 "아직 보여줄 데이터가 없다" 는 뜻이라 갱신 중(isFetching)과
    // 구분된다. 캐시가 남아있는 재방문에서는 스켈레톤이 뜨지 않는다.
    isPending,
    error,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.practices.mine(),
    // 기록이 없는 것과 조회에 실패한 것은 다르다. 서비스가 null 을 주는 쪽은
    // "없음" 이므로 빈 배열로 바꾸고, 실패는 unwrap 이 던져 error 로 간다.
    queryFn: async () => (await unwrap(getMyPractices())) ?? [],
  });

  const handleRefresh = () => {
    refetch();
  };

  const deleteMutation = useMutation({
    mutationFn: async (practiceId: string) => {
      const { error: deleteError, fileRemainsWarning } = await deletePractice(practiceId);
      if (deleteError) throw deleteError;
      return { fileRemainsWarning: fileRemainsWarning ?? false };
    },
  });

  const isDeleting = (practiceId: string) =>
    deleteMutation.isPending && deleteMutation.variables === practiceId;

  /**
   * 연습 기록 삭제.
   *
   * 개인정보처리방침 제6조가 고지한 "삭제 요구" 를 앱에서 행사하는 경로다.
   * 녹음 파일까지 함께 지운다.
   */
  const handleDelete = (item: PracticeItem) => {
    if (deleteMutation.isPending) return;

    xConfirm(
      '연습 기록 삭제',
      `'${item.topic_name_ko}' 연습 기록과 녹음 파일이 삭제됩니다.\n되돌릴 수 없습니다.`,
      async () => {
        let fileRemainsWarning = false;
        try {
          ({ fileRemainsWarning } = await deleteMutation.mutateAsync(item.id));
        } catch (deleteError) {
          xAlert('삭제 실패', getUserMessage(deleteError));
          return;
        }

        // 재조회를 기다리지 않고 캐시에서 바로 뺀다 — 목록이 즉시 반응한다.
        queryClient.setQueryData<PracticeItem[]>(queryKeys.practices.mine(), (prev) =>
          (prev ?? []).filter((p) => p.id !== item.id),
        );
        // 통계·스트릭·주간 진도도 이 기록에 딸려 있다. 앞부분만 주면 전부 걸린다.
        queryClient.invalidateQueries({ queryKey: queryKeys.practices.all });

        if (fileRemainsWarning) {
          xAlert(
            '기록은 삭제되었습니다',
            '녹음 파일 삭제에 실패했습니다. 네트워크 상태를 확인한 뒤 고객센터로 문의해 주세요.',
          );
        } else {
          showToast('삭제되었습니다.');
        }
      },
      { confirmText: '삭제' },
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 캐시가 있으면 여기 오지 않는다. 처음 열 때만 스켈레톤이다.
  if (isPending) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <SkeletonList count={5} style={{ padding: 16 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{getUserMessage(error)}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : practices.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={48} color={colors.gray300} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>연습 기록이 없습니다.</Text>
          <Text style={[styles.emptyHint, { color: colors.textDisabled }]}>스크립트에서 연습을 시작해보세요!</Text>
        </View>
      ) : (
        <FlatList
          data={practices}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <Pressable
              testID={TEST_IDS.HISTORY_CARD}
              style={[styles.practiceCard, { backgroundColor: colors.surface }]}
              onPress={() =>
                router.push({
                  pathname: '/(student)/script/practice/[practiceId]',
                  params: { practiceId: item.id },
                })
              }
            >
              <View style={styles.cardHeader}>
                <View style={[styles.topicBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.topicBadgeText, { color: colors.primary }]}>{item.topic_name_ko}</Text>
                </View>
                <Text style={[styles.date, { color: colors.textDisabled }]}>{formatDate(item.created_at)}</Text>
              </View>

              <Text style={[styles.questionText, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.question_text}
              </Text>

              <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textDisabled }]}>점수</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }, item.score != null && item.score >= 70 && { color: colors.secondary }]}>
                    {item.score ?? '-'}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textDisabled }]}>재현율</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {item.reproduction_rate != null ? `${item.reproduction_rate}%` : '-'}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textDisabled }]}>녹음</Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatDuration(item.duration)}</Text>
                </View>
                {/* 삭제 — 길게 누르기 같은 숨은 제스처 대신 보이는 버튼으로 둔다.
                    방침이 고지한 권리이고, 스크린리더로도 닿아야 한다 */}
                <Pressable
                  testID={TEST_IDS.HISTORY_DELETE_BUTTON}
                  onPress={() => handleDelete(item)}
                  disabled={isDeleting(item.id)}
                  hitSlop={12}
                  style={styles.deleteButton}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.topic_name_ko} 연습 기록 삭제`}
                  accessibilityHint="녹음 파일과 함께 삭제됩니다"
                >
                  <Ionicons
                    name={isDeleting(item.id) ? 'hourglass-outline' : 'trash-outline'}
                    size={18}
                    color={colors.textDisabled}
                  />
                </Pressable>
                <Ionicons name="chevron-forward" size={20} color={colors.textDisabled} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Pretendard-SemiBold',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyHint: {
    marginTop: 4,
    fontSize: 14,
  },
  practiceCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  topicBadgeText: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
  },
  date: {
    fontSize: 12,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
  },
  deleteButton: {
    // hitSlop 12 과 합쳐 WCAG 2.5.8 최소 24px 을 넘긴다
    padding: 4,
    marginRight: 4,
  },
});
