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

import { getConnectedStudents } from '@/services/students';
import { getClassDetail, addClassMember } from '@/services/classes';
import { getUserMessage } from '@/lib/errors';
import type { TeacherStudentListItem } from '@/lib/types';
import { useThemeColors } from '@/hooks/useTheme';

export default function AddMembersScreen() {
  const colors = useThemeColors();
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
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>학생 추가</Text>
        <View style={{ width: 40 }} />
      </View>

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.accentPinkBg }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {availableStudents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={colors.gray300} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>추가할 학생이 없습니다</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
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
                    { backgroundColor: colors.surface },
                    isSelected && [styles.studentItemSelected, { backgroundColor: colors.primaryLight, borderColor: colors.primary }],
                  ]}
                  onPress={() => toggleStudent(item.id)}
                >
                  <View style={styles.checkbox}>
                    {isSelected ? (
                      <Ionicons name="checkbox" size={24} color={colors.primary} />
                    ) : (
                      <Ionicons name="square-outline" size={24} color={colors.textDisabled} />
                    )}
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={[styles.studentName, { color: colors.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.studentEmail, { color: colors.textSecondary }]}>{item.email}</Text>
                  </View>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Bottom Button */}
          <View style={[styles.bottomContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                selectedIds.size === 0 && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={selectedIds.size === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
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
  },
  errorContainer: {
    margin: 16,
    borderRadius: 16,
    padding: 14,
  },
  errorText: {
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
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  studentItemSelected: {
    borderWidth: 1,
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
  },
  studentEmail: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  bottomContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
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
    color: '#FFFFFF',
  },
});
