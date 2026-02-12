import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getConnectedStudents } from '@/services/students';
import { getClassDetail, addClassMember } from '@/services/classes';
import { getUserMessage } from '@/lib/errors';
import type { TeacherStudentListItem } from '@/lib/types';

export default function AddMembersScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const [availableStudents, setAvailableStudents] = useState<TeacherStudentListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailableStudents = useCallback(async () => {
    if (!classId) return;
    setIsLoading(true);
    setError(null);

    // 연결된 학생 전체와 현재 반 멤버를 동시 조회
    const [studentsResult, classResult] = await Promise.all([
      getConnectedStudents(),
      getClassDetail(classId),
    ]);

    if (studentsResult.error) {
      setError(getUserMessage(studentsResult.error));
      setIsLoading(false);
      return;
    }

    const allStudents = studentsResult.data || [];
    const existingMemberIds = new Set(
      (classResult.data?.members || []).map((m) => m.id)
    );

    // 이미 반에 있는 학생 제외
    const filtered = allStudents.filter((s) => !existingMemberIds.has(s.id));
    setAvailableStudents(filtered);
    setIsLoading(false);
  }, [classId]);

  useEffect(() => {
    fetchAvailableStudents();
  }, [fetchAvailableStudents]);

  const toggleStudent = (studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);

    const results = await Promise.all(
      Array.from(selectedIds).map((studentId) =>
        addClassMember(classId, studentId)
      )
    );

    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      setError(`${failures.length}명 추가 실패`);
    }

    setIsSubmitting(false);
    router.back();
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
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
        <Text style={styles.headerTitle}>학생 추가</Text>
        <View style={{ width: 40 }} />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {availableStudents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={COLORS.GRAY_300} />
          <Text style={styles.emptyTitle}>추가할 학생이 없습니다</Text>
          <Text style={styles.emptyHint}>
            모든 연결된 학생이 이미 이 반에 소속되어 있습니다
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={availableStudents}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <Pressable
                  style={[
                    styles.studentItem,
                    isSelected && styles.studentItemSelected,
                  ]}
                  onPress={() => toggleStudent(item.id)}
                >
                  <View style={styles.checkbox}>
                    {isSelected ? (
                      <Ionicons name="checkbox" size={24} color={COLORS.PRIMARY} />
                    ) : (
                      <Ionicons name="square-outline" size={24} color={COLORS.GRAY_400} />
                    )}
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{item.name}</Text>
                    <Text style={styles.studentEmail}>{item.email}</Text>
                  </View>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Bottom Button */}
          <View style={styles.bottomContainer}>
            <Pressable
              style={[
                styles.submitButton,
                selectedIds.size === 0 && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={selectedIds.size === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.WHITE} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {selectedIds.size > 0
                    ? `${selectedIds.size}명 추가`
                    : '학생을 선택하세요'}
                </Text>
              )}
            </Pressable>
          </View>
        </>
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
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    margin: 16,
    borderRadius: 16,
    padding: 14,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
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
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  studentItemSelected: {
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  checkbox: {
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  studentEmail: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  bottomContainer: {
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  submitButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.WHITE,
  },
});
