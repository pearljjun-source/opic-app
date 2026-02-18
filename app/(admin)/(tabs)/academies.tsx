import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useThemeColors } from '@/hooks/useTheme';
import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import {
  createOwnerInvite,
  listOwnerInvites,
  deleteOwnerInvite,
  listOrganizations,
} from '@/services/admin';
import type { AdminOwnerInviteItem, AdminOrganizationItem } from '@/lib/types';

// ============================================================================
// Main Screen
// ============================================================================

export default function AdminAcademiesScreen() {
  const colors = useThemeColors();

  // ============================================================================
  // Status Badge
  // ============================================================================

  function StatusBadge({ status }: { status: string }) {
    const config = {
      pending: { label: '대기중', bg: colors.accentBlueBg, color: colors.primary },
      used: { label: '사용됨', bg: colors.accentGreenBg, color: '#059669' },
      expired: { label: '만료됨', bg: colors.surfaceSecondary, color: colors.textDisabled },
    }[status] || { label: status, bg: colors.surfaceSecondary, color: colors.textDisabled };

    return (
      <View style={[styles.badge, { backgroundColor: config.bg }]}>
        <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  }

  // ============================================================================
  // Invite Card
  // ============================================================================

  function InviteCard({
    invite,
    onDelete,
  }: {
    invite: AdminOwnerInviteItem;
    onDelete: (id: string) => void;
  }) {
    const handleCopy = async () => {
      await Clipboard.setStringAsync(invite.code);
      Alert.alert('복사 완료', `코드 ${invite.code}가 클립보드에 복사되었습니다.`);
    };

    const isPending = invite.status === 'pending';

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{invite.organization_name}</Text>
            <Pressable onPress={handleCopy} style={styles.codeRow}>
              <Text style={[styles.codeText, { color: colors.primary }]}>{invite.code}</Text>
              <Ionicons name="copy-outline" size={16} color={colors.primary} />
            </Pressable>
          </View>
          <StatusBadge status={invite.status} />
        </View>

        <View style={styles.cardMeta}>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            만료: {new Date(invite.expires_at).toLocaleDateString('ko-KR')}
          </Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            생성: {new Date(invite.created_at).toLocaleDateString('ko-KR')}
          </Text>
        </View>

        {invite.status === 'used' && invite.used_by_name && (
          <View style={[styles.usedInfo, { borderTopColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={[styles.usedText, { color: colors.textSecondary }]}>
              {invite.used_by_name} ({invite.used_by_email})
            </Text>
          </View>
        )}

        {isPending && (
          <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
            <Pressable onPress={handleCopy} style={styles.actionBtn}>
              <Ionicons name="copy-outline" size={16} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>복사</Text>
            </Pressable>
            <Pressable onPress={() => onDelete(invite.id)} style={styles.actionBtnDanger}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.actionBtnText, { color: colors.error }]}>삭제</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // ============================================================================
  // Organization Card
  // ============================================================================

  function OrgCard({ org }: { org: AdminOrganizationItem }) {
    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/(admin)/academy/${org.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{org.name}</Text>
            <View style={styles.cardMeta}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                원장: {org.owner_name} ({org.owner_email})
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textDisabled} />
        </View>
        <View style={styles.orgStats}>
          <View style={styles.orgStat}>
            <Ionicons name="people-outline" size={14} color={colors.primary} />
            <Text style={[styles.orgStatText, { color: colors.textSecondary }]}>강사 {org.teacher_count}명</Text>
          </View>
          <View style={styles.orgStat}>
            <Ionicons name="school-outline" size={14} color={colors.secondary} />
            <Text style={[styles.orgStatText, { color: colors.textSecondary }]}>학생 {org.student_count}명</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  const [invites, setInvites] = useState<AdminOwnerInviteItem[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganizationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);

    const [invitesResult, orgsResult] = await Promise.all([
      listOwnerInvites(),
      listOrganizations(),
    ]);

    if (invitesResult.error) {
      setError(getUserMessage(invitesResult.error));
    } else {
      setInvites(invitesResult.data || []);
    }

    if (orgsResult.data) {
      setOrganizations(orgsResult.data);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  const handleCreate = async () => {
    const trimmed = orgName.trim();
    if (!trimmed) return;

    setIsCreating(true);

    const days = parseInt(expiresInDays, 10);
    const result = await createOwnerInvite({
      orgName: trimmed,
      expiresInDays: isNaN(days) ? 30 : days,
    });

    if (result.error) {
      Alert.alert('오류', getUserMessage(result.error));
    } else if (result.data) {
      setModalVisible(false);
      setOrgName('');
      setExpiresInDays('30');

      Alert.alert(
        '초대 코드 생성 완료',
        `학원: ${result.data.organization_name}\n코드: ${result.data.code}\n만료: ${new Date(result.data.expires_at).toLocaleDateString('ko-KR')}`,
        [
          {
            text: '코드 복사',
            onPress: () => Clipboard.setStringAsync(result.data!.code),
          },
          { text: '확인' },
        ]
      );

      await fetchData();
    }

    setIsCreating(false);
  };

  const handleDelete = (inviteId: string) => {
    Alert.alert(
      '초대 삭제',
      '이 초대 코드를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteOwnerInvite(inviteId);
            if (result.error) {
              Alert.alert('오류', getUserMessage(result.error));
            } else {
              await fetchData();
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.accentRedBg }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* 원장 초대 섹션 */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>원장 초대</Text>
          <Pressable onPress={() => setModalVisible(true)} style={styles.addButton}>
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </Pressable>
        </View>

        {invites.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={32} color={colors.gray300} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>생성된 초대가 없습니다</Text>
          </View>
        ) : (
          invites.map((invite) => (
            <InviteCard key={invite.id} invite={invite} onDelete={handleDelete} />
          ))
        )}

        {/* 등록된 학원 섹션 */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 28 }]}>등록된 학원</Text>

        {organizations.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="business-outline" size={32} color={colors.gray300} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>등록된 학원이 없습니다</Text>
          </View>
        ) : (
          organizations.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))
        )}
      </ScrollView>

      {/* 생성 Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>원장 초대 생성</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              학원 이름을 입력하면 초대 코드가 생성됩니다.
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>학원 이름</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="예: 굿데이영어"
              placeholderTextColor={colors.textDisabled}
              value={orgName}
              onChangeText={setOrgName}
              maxLength={100}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>만료일 (일)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="30"
              placeholderTextColor={colors.textDisabled}
              value={expiresInDays}
              onChangeText={setExpiresInDays}
              keyboardType="number-pad"
              maxLength={2}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalCancel, { backgroundColor: colors.borderLight }]}
                onPress={() => {
                  setModalVisible(false);
                  setOrgName('');
                  setExpiresInDays('30');
                }}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, { backgroundColor: colors.primary }, (!orgName.trim() || isCreating) && styles.modalSubmitDisabled]}
                onPress={handleCreate}
                disabled={!orgName.trim() || isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>생성</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  errorContainer: { padding: 12, borderRadius: 8, marginBottom: 12 },
  errorText: { fontSize: 14, textAlign: 'center' },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Pretendard-Bold', marginBottom: 12 },
  addButton: { padding: 4 },

  // Card
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', marginBottom: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  codeText: { fontSize: 20, fontFamily: 'Pretendard-Bold', letterSpacing: 4 },
  cardMeta: { marginTop: 10, gap: 2 },
  metaText: { fontSize: 12, fontFamily: 'Pretendard-Regular' },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  actionBtnDanger: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  actionBtnText: { fontSize: 13, fontFamily: 'Pretendard-Medium' },

  // Badge
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontFamily: 'Pretendard-Medium' },

  // Used info
  usedInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  usedText: { fontSize: 13, fontFamily: 'Pretendard-Regular' },

  // Org stats
  orgStats: { flexDirection: 'row', gap: 16, marginTop: 10 },
  orgStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orgStatText: { fontSize: 13, fontFamily: 'Pretendard-Medium' },

  // Empty
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Regular', marginTop: 8 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontFamily: 'Pretendard-Bold', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, fontFamily: 'Pretendard-Regular', marginBottom: 20 },
  inputLabel: { fontSize: 13, fontFamily: 'Pretendard-Medium', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontFamily: 'Pretendard-Medium' },
  modalSubmit: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalSubmitDisabled: { opacity: 0.5 },
  modalSubmitText: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: '#FFFFFF' },
});
