import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getClassDetail, deleteClass, removeClassMember } from '@/services/classes';
import { StudentCard } from '@/components/teacher';
import { getUserMessage } from '@/lib/errors';
import type { ClassMemberItem } from '@/lib/types';

export default function ClassDetailScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const [className, setClassName] = useState('');
  const [classDescription, setClassDescription] = useState<string | null>(null);
  const [members, setMembers] = useState<ClassMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!classId) return;
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await getClassDetail(classId);

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else if (data && data.success) {
      setClassName(data.class?.name || '');
      setClassDescription(data.class?.description || null);
      setMembers(data.members || []);
    } else if (data && data.error) {
      setError(data.error);
    }

    setIsLoading(false);
  }, [classId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleDeleteClass = () => {
    Alert.alert(
      '반 삭제',
      '이 반을 삭제하시겠습니까?\n학생들은 삭제되지 않습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteClass(classId);
            if (result.success) {
              router.back();
            } else {
              Alert.alert('오류', result.error || '삭제에 실패했습니다');
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = (studentId: string, studentName: string) => {
    Alert.alert(
      '학생 제외',
      `${studentName}님을 반에서 제외하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '제외',
          style: 'destructive',
          onPress: async () => {
            const result = await removeClassMember(classId, studentId);
            if (result.success) {
              fetchDetail();
            } else {
              Alert.alert('오류', result.error || '제외에 실패했습니다');
            }
          },
        },
      ]
    );
  };

  const handleStudentPress = (studentId: string) => {
    router.push(`/student/${studentId}`);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchDetail}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{className}</Text>
        <Pressable onPress={handleDeleteClass} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={22} color={COLORS.ERROR} />
        </Pressable>
      </View>

      {/* Class Info */}
      {classDescription ? (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{classDescription}</Text>
        </View>
      ) : null}

      {/* Members Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>학생 ({members.length}명)</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push(`/class/${classId}/add-members` as any)}
        >
          <Ionicons name="person-add-outline" size={18} color={COLORS.PRIMARY} />
          <Text style={styles.addButtonText}>추가</Text>
        </Pressable>
      </View>

      {members.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={COLORS.GRAY_300} />
          <Text style={styles.emptyTitle}>반에 소속된 학생이 없습니다</Text>
          <Text style={styles.emptyHint}>연결된 학생을 이 반에 추가하세요</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => handleRemoveMember(item.id, item.name)}
            >
              <StudentCard
                student={{
                  id: item.id,
                  name: item.name,
                  email: item.email,
                  role: 'student' as any,
                  created_at: '' as any,
                  scripts_count: item.scripts_count as any,
                  practices_count: item.practices_count as any,
                  last_practice_at: item.last_practice_at as any,
                  avg_score: item.avg_score as any,
                  avg_reproduction_rate: item.avg_reproduction_rate as any,
                } as any}
                onPress={() => handleStudentPress(item.id)}
              />
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  deleteButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionContainer: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
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
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
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
});
