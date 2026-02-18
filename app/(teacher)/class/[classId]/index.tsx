import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getClassDetail, getTeacherClasses, deleteClass, removeClassMember, updateClass, moveClassMember } from '@/services/classes';
import { StudentCard } from '@/components/teacher';
import { getUserMessage } from '@/lib/errors';
import type { ClassMemberItem, TeacherClassListItem } from '@/lib/types';
import { useThemeColors } from '@/hooks/useTheme';

export default function ClassDetailScreen() {
  const colors = useThemeColors();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const [className, setClassName] = useState('');
  const [classDescription, setClassDescription] = useState<string | null>(null);
  const [members, setMembers] = useState<ClassMemberItem[]>([]);
  const [otherClasses, setOtherClasses] = useState<TeacherClassListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 반 이동 모달 상태
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!classId) return;
    setIsLoading(true);
    setError(null);

    const [detailResult, classesResult] = await Promise.all([
      getClassDetail(classId),
      getTeacherClasses(),
    ]);

    if (detailResult.error) {
      setError(getUserMessage(detailResult.error));
    } else if (detailResult.data && detailResult.data.success) {
      setClassName(detailResult.data.class?.name || '');
      setClassDescription(detailResult.data.class?.description || null);
      setMembers(detailResult.data.members || []);
    } else if (detailResult.data && detailResult.data.error) {
      setError(detailResult.data.error);
    }

    // 현재 반 제외한 다른 반 목록
    if (classesResult.data) {
      setOtherClasses(classesResult.data.filter(c => c.id !== classId));
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

  const handleOpenEdit = () => {
    setEditName(className);
    setEditDescription(classDescription || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      Alert.alert('오류', '반 이름을 입력해주세요');
      return;
    }

    setIsSaving(true);
    const result = await updateClass(classId, trimmedName, editDescription.trim() || undefined);
    setIsSaving(false);

    if (result.success) {
      setClassName(trimmedName);
      setClassDescription(editDescription.trim() || null);
      setShowEditModal(false);
    } else {
      Alert.alert('오류', result.error || '수정에 실패했습니다');
    }
  };

  const handleMemberLongPress = (studentId: string, studentName: string) => {
    const buttons: any[] = [];

    if (otherClasses.length > 0) {
      buttons.push({
        text: '다른 반으로 이동',
        onPress: () => {
          setMoveTarget({ id: studentId, name: studentName });
          setShowMoveModal(true);
        },
      });
    }

    buttons.push({
      text: '반에서 제외',
      style: 'destructive',
      onPress: () => handleRemoveMember(studentId, studentName),
    });

    buttons.push({ text: '취소', style: 'cancel' });

    Alert.alert(studentName, undefined, buttons);
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

  const handleMoveToClass = async (toClassId: string, toClassName: string) => {
    if (!moveTarget) return;

    setIsMoving(true);
    const result = await moveClassMember(classId, toClassId, moveTarget.id);
    setIsMoving(false);

    if (result.success) {
      setShowMoveModal(false);
      setMoveTarget(null);
      Alert.alert('이동 완료', `${moveTarget.name}님을 "${toClassName}"으로 이동했습니다.`);
      fetchDetail();
    } else {
      Alert.alert('오류', result.error || '이동에 실패했습니다');
    }
  };

  const handleStudentPress = (studentId: string) => {
    router.push(`/student/${studentId}`);
  };

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
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchDetail}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{className}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={handleOpenEdit} style={styles.headerActionButton}>
            <Ionicons name="pencil-outline" size={20} color={colors.primary} />
          </Pressable>
          <Pressable onPress={handleDeleteClass} style={styles.headerActionButton}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        </View>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKeyboard}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowEditModal(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>반 정보 수정</Text>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>반 이름</Text>
              <TextInput
                style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="반 이름"
                maxLength={50}
                autoFocus
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>설명 (선택)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="반 설명을 입력하세요"
                maxLength={200}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, { backgroundColor: colors.primary }, isSaving && styles.saveButtonDisabled]}
                  onPress={handleSaveEdit}
                  disabled={isSaving}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? '저장 중...' : '저장'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Move Modal */}
      <Modal
        visible={showMoveModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowMoveModal(false); setMoveTarget(null); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setShowMoveModal(false); setMoveTarget(null); }}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>이동할 반 선택</Text>
            {moveTarget && (
              <Text style={[styles.moveSubtitle, { color: colors.textSecondary }]}>{moveTarget.name}님을 이동합니다</Text>
            )}

            {isMoving ? (
              <View style={styles.movingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.movingText, { color: colors.textSecondary }]}>이동 중...</Text>
              </View>
            ) : (
              <ScrollView style={styles.classPickerList} showsVerticalScrollIndicator={false}>
                {otherClasses.map((cls) => (
                  <Pressable
                    key={cls.id}
                    style={({ pressed }) => [
                      styles.classPickerItem,
                      { backgroundColor: colors.surfaceSecondary },
                      pressed && styles.classPickerItemPressed,
                    ]}
                    onPress={() => handleMoveToClass(cls.id, cls.name)}
                  >
                    <Ionicons name="school-outline" size={20} color={colors.primary} />
                    <View style={styles.classPickerInfo}>
                      <Text style={[styles.classPickerName, { color: colors.textPrimary }]}>{cls.name}</Text>
                      <Text style={[styles.classPickerCount, { color: colors.textSecondary }]}>{cls.member_count}명</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Pressable
              style={[styles.moveCancelButton, { borderColor: colors.border }]}
              onPress={() => { setShowMoveModal(false); setMoveTarget(null); }}
              disabled={isMoving}
            >
              <Text style={[styles.moveCancelButtonText, { color: colors.textSecondary }]}>취소</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Class Info */}
      {classDescription ? (
        <View style={[styles.descriptionContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{classDescription}</Text>
        </View>
      ) : null}

      {/* Members Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>학생 ({members.length}명)</Text>
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primaryLight }]}
          onPress={() => router.push(`/class/${classId}/add-members` as any)}
        >
          <Ionicons name="person-add-outline" size={18} color={colors.primary} />
          <Text style={[styles.addButtonText, { color: colors.primary }]}>추가</Text>
        </Pressable>
      </View>

      {members.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={colors.gray300} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>반에 소속된 학생이 없습니다</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>연결된 학생을 이 반에 추가하세요</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
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
              onAction={() => handleMemberLongPress(item.id, item.name)}
            />
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    flex: 1,
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
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
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addButtonText: {
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
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
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
  // Edit Modal
  modalKeyboard: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  // Move Modal
  moveSubtitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 16,
  },
  classPickerList: {
    maxHeight: 300,
  },
  classPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  classPickerItemPressed: {
    opacity: 0.7,
  },
  classPickerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  classPickerName: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  classPickerCount: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  movingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  movingText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  moveCancelButton: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  moveCancelButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
});
