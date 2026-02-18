import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { computeTeacherDashboardStats, computeAttentionItems } from '@/lib/helpers';
import { getConnectedStudents } from '@/services/students';
import { StudentCard, AttentionSection, TeacherCompactStatsStrip } from '@/components/teacher';
import type { TeacherStudentListItem } from '@/lib/types';
import { getUserMessage } from '@/lib/errors';
import { useThemeColors } from '@/hooks/useTheme';

export default function TeacherDashboard() {
  const colors = useThemeColors();
  const [students, setStudents] = useState<TeacherStudentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await getConnectedStudents();

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setStudents(data || []);
    }

    setIsLoading(false);
  }, []);

  // 초기 로드
  const isFirstMount = useRef(true);
  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // 화면 포커스 시 데이터 재조회 (학생 삭제/연결 해제 후 돌아올 때)
  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      fetchStudents();
    }, [fetchStudents]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchStudents();
    setIsRefreshing(false);
  }, [fetchStudents]);

  const handleStudentPress = (studentId: string) => {
    router.push(`/student/${studentId}`);
  };

  // ========== Render ==========

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchStudents}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  if (students.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="people-outline" size={48} color={colors.gray300} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>연결된 학생이 없습니다</Text>
        <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
          초대 탭에서 초대 코드를 생성하여{'\n'}
          학생들을 초대하세요.
        </Text>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/invite')}
        >
          <Text style={styles.actionButtonText}>학생 초대하기</Text>
        </Pressable>
      </View>
    );
  }

  const dashboardStats = computeTeacherDashboardStats(students);
  const attentionItems = computeAttentionItems(students);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* 컴팩트 통계 스트립 */}
      <TeacherCompactStatsStrip stats={dashboardStats} />

      {/* 관심 필요 섹션 */}
      <AttentionSection
        items={attentionItems}
        onStudentPress={handleStudentPress}
      />

      {/* 학생 카드 목록 */}
      <View style={[styles.studentListHeader, { borderTopColor: colors.border }]}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="people" size={16} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>전체 학생</Text>
        </View>
        <View style={[styles.sectionCountBadge, { backgroundColor: colors.borderLight }]}>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{students.length}명</Text>
        </View>
      </View>
      {students.map((item) => (
        <View key={item.id} style={styles.studentCardWrapper}>
          <StudentCard
            student={item}
            onPress={() => handleStudentPress(item.id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  studentListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
    letterSpacing: 0.5,
  },
  sectionCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
  },
  studentCardWrapper: {
    marginHorizontal: 16,
  },
});
