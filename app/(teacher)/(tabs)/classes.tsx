import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getTeacherClasses } from '@/services/classes';
import { ClassCard } from '@/components/teacher';
import type { TeacherClassListItem } from '@/lib/types';
import { getUserMessage } from '@/lib/errors';

export default function ClassesTab() {
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (error && classes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchClasses}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 반 만들기 버튼 */}
      <Pressable
        style={styles.createClassButton}
        onPress={() => router.push('/class/create')}
      >
        <Ionicons name="add-circle-outline" size={20} color={COLORS.PRIMARY} />
        <Text style={styles.createClassButtonText}>반 만들기</Text>
      </Pressable>

      {classes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="school-outline" size={48} color={COLORS.GRAY_300} />
          <Text style={styles.emptyTitle}>생성된 반이 없습니다</Text>
          <Text style={styles.emptyHint}>
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
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
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
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    borderStyle: 'dashed',
  },
  createClassButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
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
    color: COLORS.TEXT_PRIMARY,
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
});
