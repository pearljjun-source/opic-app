import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/hooks/useAuth';
import { canManageOrg } from '@/lib/permissions';
import { updateOrganization } from '@/services/organizations';
import { useThemeColors } from '@/hooks/useTheme';

export default function AcademyInfoScreen() {
  const colors = useThemeColors();
  const { currentOrg, orgRole, refreshUser } = useAuth();
  const [orgName, setOrgName] = useState(currentOrg?.name || '');

  // 학원명 수정 모달
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentOrg) setOrgName(currentOrg.name);
  }, [currentOrg]);

  const handleOpenEdit = () => {
    setEditName(orgName);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!currentOrg) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('오류', '학원명을 입력해주세요');
      return;
    }

    setIsSaving(true);
    const result = await updateOrganization(currentOrg.id, trimmed);
    setIsSaving(false);

    if (result.success) {
      setOrgName(trimmed);
      setShowEditModal(false);
      refreshUser();
    } else {
      Alert.alert('오류', result.error || '수정에 실패했습니다');
    }
  };

  if (!currentOrg || !canManageOrg(orgRole)) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.gray300} />
        <Text style={[styles.guardText, { color: colors.textSecondary }]}>접근 권한이 없습니다</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surfaceSecondary }]} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>학원명</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.value, { color: colors.textPrimary }]}>{orgName}</Text>
            <Pressable
              style={({ pressed }) => [styles.editButton, pressed && { backgroundColor: colors.borderLight }]}
              onPress={handleOpenEdit}
              hitSlop={8}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>전체 멤버</Text>
          <Text style={[styles.value, { color: colors.textPrimary }]}>{currentOrg.member_count}명</Text>
        </View>
      </View>

      {/* 학원명 수정 모달 */}
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
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>학원명 수정</Text>
              <TextInput
                style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="학원명을 입력하세요"
                maxLength={100}
                autoFocus
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  guardText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
    marginTop: 12,
  },
  card: {
    borderRadius: 16,
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
  value: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  editButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  // Modal
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
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 16,
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
});
