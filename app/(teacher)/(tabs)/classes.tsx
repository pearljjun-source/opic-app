import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getTeacherClasses } from '@/services/classes';
import { ClassCard } from '@/components/teacher';
import type { TeacherClassListItem } from '@/lib/types';
import { getUserMessage } from '@/lib/errors';
import { useThemeColors } from '@/hooks/useTheme';

export default function ClassesTab() {
  const colors = useThemeColors();
  const [classes, setClasses] = useState<TeacherClassListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchClasses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await getTeacherClasses();

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setClasses(data || []);
    }

    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchClasses();
    }, [fetchClasses])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchClasses();
    setIsRefreshing(false);
  }, [fetchClasses]);

  const handleClassPress = (classId: string) => {
    router.push(`/class/${classId}` as any);
  };

  // ========== Render ==========

  if (isLoading && classes.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && classes.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchClasses}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* 반 만들기 버튼 */}
      <Pressable
        style={[styles.createClassButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        onPress={() => router.push('/class/create')}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={[styles.createClassButtonText, { color: colors.primary }]}>반 만들기</Text>
      </Pressable>

      {classes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="school-outline" size={48} color={colors.gray300} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>생성된 반이 없습니다</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            반을 만들어 학생들을{'\n'}그룹으로 관리하세요
          </Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClassCard
              classItem={item}
              onPress={() => handleClassPress(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </View>
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
  createClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  createClassButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
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
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
});
