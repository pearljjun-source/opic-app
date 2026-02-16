import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, RefreshControl, Modal, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

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
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { label: '대기중', bg: '#DBEAFE', color: COLORS.PRIMARY },
    used: { label: '사용됨', bg: '#D1FAE5', color: '#059669' },
    expired: { label: '만료됨', bg: '#F3F4F6', color: COLORS.GRAY },
  }[status] || { label: status, bg: '#F3F4F6', color: COLORS.GRAY };

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
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{invite.organization_name}</Text>
          <Pressable onPress={handleCopy} style={styles.codeRow}>
            <Text style={styles.codeText}>{invite.code}</Text>
            <Ionicons name="copy-outline" size={16} color={COLORS.PRIMARY} />
          </Pressable>
        </View>
        <StatusBadge status={invite.status} />
      </View>

      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>
          만료: {new Date(invite.expires_at).toLocaleDateString('ko-KR')}
        </Text>
        <Text style={styles.metaText}>
          생성: {new Date(invite.created_at).toLocaleDateString('ko-KR')}
        </Text>
      </View>

      {invite.status === 'used' && invite.used_by_name && (
        <View style={styles.usedInfo}>
          <Ionicons name="checkmark-circle" size={14} color="#059669" />
          <Text style={styles.usedText}>
            {invite.used_by_name} ({invite.used_by_email})
          </Text>
        </View>
      )}

      {isPending && (
        <View style={styles.cardActions}>
          <Pressable onPress={handleCopy} style={styles.actionBtn}>
            <Ionicons name="copy-outline" size={16} color={COLORS.PRIMARY} />
            <Text style={styles.actionBtnText}>복사</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(invite.id)} style={styles.actionBtnDanger}>
            <Ionicons name="trash-outline" size={16} color={COLORS.ERROR} />
            <Text style={[styles.actionBtnText, { color: COLORS.ERROR }]}>삭제</Text>
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
      style={styles.card}
      onPress={() => router.push(`/(admin)/academy/${org.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{org.name}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>
              원장: {org.owner_name} ({org.owner_email})
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.GRAY_400} />
      </View>
      <View style={styles.orgStats}>
        <View style={styles.orgStat}>
          <Ionicons name="people-outline" size={14} color={COLORS.PRIMARY} />
          <Text style={styles.orgStatText}>강사 {org.teacher_count}명</Text>
        </View>
        <View style={styles.orgStat}>
          <Ionicons name="school-outline" size={14} color={COLORS.SECONDARY} />
          <Text style={styles.orgStatText}>학생 {org.student_count}명</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ============================================================================
// Main Screen
// ============================================================================

export default function AdminAcademiesScreen() {
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.PRIMARY} />
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 원장 초대 섹션 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>원장 초대</Text>
          <Pressable onPress={() => setModalVisible(true)} style={styles.addButton}>
            <Ionicons name="add-circle" size={28} color={COLORS.PRIMARY} />
          </Pressable>
        </View>

        {invites.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="mail-outline" size={32} color={COLORS.GRAY_300} />
            <Text style={styles.emptyText}>생성된 초대가 없습니다</Text>
          </View>
        ) : (
          invites.map((invite) => (
            <InviteCard key={invite.id} invite={invite} onDelete={handleDelete} />
          ))
        )}

        {/* 등록된 학원 섹션 */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>등록된 학원</Text>

        {organizations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="business-outline" size={32} color={COLORS.GRAY_300} />
            <Text style={styles.emptyText}>등록된 학원이 없습니다</Text>
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
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>원장 초대 생성</Text>
            <Text style={styles.modalSubtitle}>
              학원 이름을 입력하면 초대 코드가 생성됩니다.
            </Text>

            <Text style={styles.inputLabel}>학원 이름</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 굿데이영어"
              placeholderTextColor={COLORS.GRAY_400}
              value={orgName}
              onChangeText={setOrgName}
              maxLength={100}
              autoFocus
            />

            <Text style={styles.inputLabel}>만료일 (일)</Text>
            <TextInput
              style={styles.input}
              placeholder="30"
              placeholderTextColor={COLORS.GRAY_400}
              value={expiresInDays}
              onChangeText={setExpiresInDays}
              keyboardType="number-pad"
              maxLength={2}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  setModalVisible(false);
                  setOrgName('');
                  setExpiresInDays('30');
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, (!orgName.trim() || isCreating) && styles.modalSubmitDisabled]}
                onPress={handleCreate}
                disabled={!orgName.trim() || isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={COLORS.WHITE} />
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
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BACKGROUND_SECONDARY },

  errorContainer: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 12 },
  errorText: { color: COLORS.ERROR, fontSize: 14, textAlign: 'center' },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY, marginBottom: 12 },
  addButton: { padding: 4 },

  // Card
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: COLORS.TEXT_PRIMARY, marginBottom: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  codeText: { fontSize: 20, fontFamily: 'Pretendard-Bold', color: COLORS.PRIMARY, letterSpacing: 4 },
  cardMeta: { marginTop: 10, gap: 2 },
  metaText: { fontSize: 12, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.BORDER },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  actionBtnDanger: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  actionBtnText: { fontSize: 13, fontFamily: 'Pretendard-Medium', color: COLORS.PRIMARY },

  // Badge
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontFamily: 'Pretendard-Medium' },

  // Used info
  usedInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.BORDER },
  usedText: { fontSize: 13, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY },

  // Org stats
  orgStats: { flexDirection: 'row', gap: 16, marginTop: 10 },
  orgStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orgStatText: { fontSize: 13, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },

  // Empty
  emptyCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
  },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginTop: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { backgroundColor: COLORS.WHITE, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginBottom: 20 },
  inputLabel: { fontSize: 13, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_PRIMARY, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.GRAY_50,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_PRIMARY,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.GRAY_100 },
  modalCancelText: { fontSize: 15, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },
  modalSubmit: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.PRIMARY },
  modalSubmitDisabled: { opacity: 0.5 },
  modalSubmitText: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: COLORS.WHITE },
});
