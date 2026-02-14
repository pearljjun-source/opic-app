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

import { COLORS } from '@/lib/constants';
import { getClassDetail, getTeacherClasses, deleteClass, removeClassMember, updateClass, moveClassMember } from '@/services/classes';
import { StudentCard } from '@/components/teacher';
import { getUserMessage } from '@/lib/errors';
import type { ClassMemberItem, TeacherClassListItem } from '@/lib/types';

export default function ClassDetailScreen() {
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
        <View style={styles.headerActions}>
          <Pressable onPress={handleOpenEdit} style={styles.headerActionButton}>
            <Ionicons name="pencil-outline" size={20} color={COLORS.PRIMARY} />
          </Pressable>
          <Pressable onPress={handleDeleteClass} style={styles.headerActionButton}>
            <Ionicons name="trash-outline" size={20} color={COLORS.ERROR} />
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
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <Text style={styles.modalTitle}>반 정보 수정</Text>

              <Text style={styles.inputLabel}>반 이름</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="반 이름"
                maxLength={50}
                autoFocus
              />

              <Text style={styles.inputLabel}>설명 (선택)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="반 설명을 입력하세요"
                maxLength={200}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
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
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>이동할 반 선택</Text>
            {moveTarget && (
              <Text style={styles.moveSubtitle}>{moveTarget.name}님을 이동합니다</Text>
            )}

            {isMoving ? (
              <View style={styles.movingContainer}>
                <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                <Text style={styles.movingText}>이동 중...</Text>
              </View>
            ) : (
              <ScrollView style={styles.classPickerList} showsVerticalScrollIndicator={false}>
                {otherClasses.map((cls) => (
                  <Pressable
                    key={cls.id}
                    style={({ pressed }) => [
                      styles.classPickerItem,
                      pressed && styles.classPickerItemPressed,
                    ]}
                    onPress={() => handleMoveToClass(cls.id, cls.name)}
                  >
                    <Ionicons name="school-outline" size={20} color={COLORS.PRIMARY} />
                    <View style={styles.classPickerInfo}>
                      <Text style={styles.classPickerName}>{cls.name}</Text>
                      <Text style={styles.classPickerCount}>{cls.member_count}명</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.GRAY_300} />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Pressable
              style={styles.moveCancelButton}
              onPress={() => { setShowMoveModal(false); setMoveTarget(null); }}
              disabled={isMoving}
            >
              <Text style={styles.moveCancelButtonText}>취소</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_PRIMARY,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
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
    borderColor: COLORS.BORDER,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
  // Move Modal
  moveSubtitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
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
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
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
    color: COLORS.TEXT_PRIMARY,
  },
  classPickerCount: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
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
    color: COLORS.TEXT_SECONDARY,
  },
  moveCancelButton: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    marginTop: 8,
  },
  moveCancelButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
  },
});
