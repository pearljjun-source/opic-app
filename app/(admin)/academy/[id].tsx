import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl,
  Alert, Modal, TextInput,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';
import { getUserMessage } from '@/lib/errors';
import {
  listOrganizations, getOrganizationDetail, getOrganizationPayments,
  updateOrganization, deleteOrganization,
  adminUpdateSubscription, adminCancelSubscription,
} from '@/services/admin';
import { getSubscriptionPlans } from '@/services/billing';
import type {
  AdminOrganizationItem, AdminOrgMemberItem, AdminOrgSubscription,
  PaymentRecord, SubscriptionPlan,
} from '@/lib/types';

// ============================================================================
// Main
// ============================================================================

export default function AcademyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  // ============================================================================
  // Status / Role Badges (theme-aware)
  // ============================================================================

  const SUB_STATUS: Record<string, { text: string; bg: string; color: string }> = {
    active: { text: '활성', bg: colors.accentGreenBg, color: colors.accentGreenText },
    trialing: { text: '체험', bg: colors.accentBlueBg, color: colors.accentBlueText },
    past_due: { text: '연체', bg: colors.accentYellowBg, color: colors.accentYellowText },
  };

  const ROLE_STYLE: Record<string, { text: string; bg: string; color: string }> = {
    owner: { text: '원장', bg: '#EDE9FE', color: '#7C3AED' },
    teacher: { text: '강사', bg: colors.accentBlueBg, color: colors.accentBlueText },
    student: { text: '학생', bg: colors.accentGreenBg, color: colors.accentGreenText },
  };

  const PAY_STATUS: Record<string, { text: string; color: string }> = {
    paid: { text: '완료', color: colors.success },
    pending: { text: '대기', color: colors.warning },
    failed: { text: '실패', color: colors.error },
    refunded: { text: '환불', color: colors.gray500 },
    canceled: { text: '취소', color: colors.gray400 },
  };

  const [org, setOrg] = useState<AdminOrganizationItem | null>(null);
  const [members, setMembers] = useState<AdminOrgMemberItem[]>([]);
  const [subscription, setSubscription] = useState<AdminOrgSubscription | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit org modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Plan change modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>('');
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  // Delete org modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setError(null);

    try {
      const [orgsResult, detailResult, paymentsResult] = await Promise.all([
        listOrganizations(),
        getOrganizationDetail(id),
        getOrganizationPayments(id),
      ]);

      const errors: string[] = [];

      if (orgsResult.error) {
        if (__DEV__) console.warn('[AcademyDetail] listOrganizations error:', orgsResult.error);
        errors.push(getUserMessage(orgsResult.error));
      } else {
        const found = orgsResult.data?.find(o => o.id === id) || null;
        setOrg(found);
      }

      if (detailResult.data) {
        setMembers(detailResult.data.members);
        setSubscription(detailResult.data.subscription);
      } else if (detailResult.error) {
        if (__DEV__) console.warn('[AcademyDetail] getOrganizationDetail error:', detailResult.error);
        errors.push(getUserMessage(detailResult.error));
      }

      if (paymentsResult.error) {
        if (__DEV__) console.warn('[AcademyDetail] getOrganizationPayments error:', paymentsResult.error);
      }
      if (paymentsResult.data) {
        setPayments(paymentsResult.data);
      }

      if (errors.length > 0) {
        setError(errors[0]);
      }
    } catch (err) {
      if (__DEV__) console.warn('[AcademyDetail] fetchData exception:', err);
      setError(getUserMessage(err));
    }

    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  const formatCurrency = (amount: number) =>
    `\u20A9${amount.toLocaleString()}`;

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleEditOrg = () => {
    if (!org) return;
    setEditName(org.name);
    setShowEditModal(true);
  };

  const handleSaveOrg = async () => {
    if (!id || !editName.trim()) return;
    setIsSaving(true);
    const result = await updateOrganization(id, { name: editName.trim() });
    setIsSaving(false);

    if (result.error) {
      Alert.alert('오류', getUserMessage(result.error));
    } else {
      setShowEditModal(false);
      await fetchData();
    }
  };

  const handleOpenPlanModal = async () => {
    const result = await getSubscriptionPlans();
    if (result.error) {
      Alert.alert('오류', getUserMessage(result.error));
      return;
    }
    setPlans(result.data || []);
    setSelectedPlanKey(subscription?.plan_key || '');
    setShowPlanModal(true);
  };

  const handleChangePlan = async () => {
    if (!id || !selectedPlanKey) return;
    setIsChangingPlan(true);
    const result = await adminUpdateSubscription(id, selectedPlanKey);
    setIsChangingPlan(false);

    if (result.error) {
      Alert.alert('오류', getUserMessage(result.error));
    } else {
      setShowPlanModal(false);
      const actionText = result.data?.action === 'subscription_create' ? '구독이 생성되었습니다.' : '플랜이 변경되었습니다.';
      Alert.alert('완료', actionText);
      await fetchData();
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      '구독 취소',
      '어떤 방식으로 취소하시겠습니까?',
      [
        { text: '돌아가기', style: 'cancel' },
        {
          text: '기간 만료 시',
          onPress: async () => {
            const result = await adminCancelSubscription(id!, false);
            if (result.error) {
              Alert.alert('오류', getUserMessage(result.error));
            } else {
              Alert.alert('완료', '기간 만료 시 자동 해지됩니다.');
              await fetchData();
            }
          },
        },
        {
          text: '즉시 취소',
          style: 'destructive',
          onPress: async () => {
            const result = await adminCancelSubscription(id!, true);
            if (result.error) {
              Alert.alert('오류', getUserMessage(result.error));
            } else {
              Alert.alert('완료', '구독이 즉시 취소되었습니다.');
              await fetchData();
            }
          },
        },
      ]
    );
  };

  const handleDeleteOrg = async () => {
    if (!id) return;
    setIsDeleting(true);
    const result = await deleteOrganization(id, deleteReason.trim() || undefined);
    setIsDeleting(false);

    if (result.error) {
      Alert.alert('오류', getUserMessage(result.error));
    } else {
      setShowDeleteModal(false);
      Alert.alert('완료', '학원이 삭제되었습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.surfaceSecondary }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>학원 상세</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

        {org && (
          <>
            {/* 학원 정보 */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.orgInfoRow}>
                <View style={[styles.orgIconWrapper, { backgroundColor: colors.accentBlueBg }]}>
                  <Ionicons name="business" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.orgNameRow}>
                    <Text style={[styles.orgName, { color: colors.textPrimary }]}>{org.name}</Text>
                    <Pressable onPress={handleEditOrg} hitSlop={8}>
                      <Ionicons name="create-outline" size={18} color={colors.primary} />
                    </Pressable>
                  </View>
                  <Text style={[styles.orgMeta, { color: colors.textSecondary }]}>
                    원장: {org.owner_name} ({org.owner_email})
                  </Text>
                  <Text style={[styles.orgMeta, { color: colors.textSecondary }]}>
                    개설: {new Date(org.created_at).toLocaleDateString('ko-KR')}
                  </Text>
                </View>
              </View>
              <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{org.member_count}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>전체</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{org.teacher_count}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>강사</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>{org.student_count}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>학생</Text>
                </View>
              </View>
            </View>

            {/* 구독 정보 */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>구독</Text>
            {subscription ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.subRow}>
                  <Text style={[styles.subPlan, { color: colors.textPrimary }]}>{subscription.plan_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {subscription.cancel_at_period_end && (
                      <View style={[styles.badge, { backgroundColor: colors.accentRedBg }]}>
                        <Text style={[styles.badgeText, { color: colors.error }]}>해지 예정</Text>
                      </View>
                    )}
                    <View style={[styles.badge, { backgroundColor: (SUB_STATUS[subscription.status] || SUB_STATUS.active).bg }]}>
                      <Text style={[styles.badgeText, { color: (SUB_STATUS[subscription.status] || SUB_STATUS.active).color }]}>
                        {(SUB_STATUS[subscription.status] || { text: subscription.status }).text}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.subPeriod, { color: colors.textSecondary }]}>
                  만료: {new Date(subscription.current_period_end).toLocaleDateString('ko-KR')}
                </Text>
                <View style={[styles.subActions, { borderTopColor: colors.border }]}>
                  <Pressable style={styles.subActionBtn} onPress={handleOpenPlanModal}>
                    <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                    <Text style={[styles.subActionText, { color: colors.primary }]}>플랜 변경</Text>
                  </Pressable>
                  <Pressable style={styles.subActionBtn} onPress={handleCancelSubscription}>
                    <Ionicons name="close-circle-outline" size={16} color={colors.error} />
                    <Text style={[styles.subActionText, { color: colors.error }]}>구독 취소</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="card-outline" size={24} color={colors.gray300} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>구독 없음</Text>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                  onPress={handleOpenPlanModal}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>구독 생성</Text>
                </Pressable>
              </View>
            )}

            {/* 멤버 목록 */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>멤버 ({members.length})</Text>
            {members.map((member) => {
              const role = ROLE_STYLE[member.role] || ROLE_STYLE.student;
              return (
                <Pressable
                  key={member.id}
                  style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(`/(admin)/user/${member.user_id}`)}
                >
                  <View style={styles.memberMain}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: colors.textPrimary }]}>{member.name}</Text>
                      <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>{member.email}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: role.bg }]}>
                      <Text style={[styles.badgeText, { color: role.color }]}>{role.text}</Text>
                    </View>
                  </View>
                  <Text style={[styles.memberDate, { color: colors.gray400 }]}>
                    가입: {new Date(member.created_at).toLocaleDateString('ko-KR')}
                  </Text>
                </Pressable>
              );
            })}
            {members.length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="people-outline" size={24} color={colors.gray300} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>멤버가 없습니다</Text>
              </View>
            )}

            {/* 결제 내역 */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>결제 내역</Text>
            {payments.map((payment) => {
              const status = PAY_STATUS[payment.status] || { text: payment.status, color: colors.gray400 };
              return (
                <View key={payment.id} style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.paymentMain}>
                    <View>
                      <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>{formatCurrency(payment.amount)}</Text>
                      <Text style={[styles.paymentDate, { color: colors.gray400 }]}>
                        {new Date(payment.created_at).toLocaleDateString('ko-KR')}
                      </Text>
                    </View>
                    <View style={[styles.payBadge, { backgroundColor: status.color }]}>
                      <Text style={styles.payBadgeText}>{status.text}</Text>
                    </View>
                  </View>
                  {payment.card_last4 && (
                    <Text style={[styles.paymentMeta, { color: colors.gray400 }]}>**** {payment.card_last4}</Text>
                  )}
                  {payment.failure_reason && (
                    <Text style={[styles.failureText, { color: colors.error }]}>{payment.failure_reason}</Text>
                  )}
                </View>
              );
            })}
            {payments.length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="receipt-outline" size={24} color={colors.gray300} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>결제 내역이 없습니다</Text>
              </View>
            )}

            {/* 학원 삭제 */}
            <Pressable
              style={[styles.deleteOrgBtn, { borderColor: colors.error }]}
              onPress={() => setShowDeleteModal(true)}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.deleteOrgText, { color: colors.error }]}>학원 삭제</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* ================================================================== */}
      {/* 이름 수정 모달 */}
      {/* ================================================================== */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>학원 이름 수정</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="학원 이름"
              placeholderTextColor={colors.textDisabled}
              maxLength={100}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }, isSaving && { opacity: 0.7 }]}
                onPress={handleSaveOrg}
                disabled={isSaving || !editName.trim()}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>저장</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* 플랜 변경 모달 */}
      {/* ================================================================== */}
      <Modal visible={showPlanModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {subscription ? '플랜 변경' : '구독 생성'}
            </Text>
            {plans.map((plan) => {
              const isSelected = selectedPlanKey === plan.plan_key;
              const isCurrent = subscription?.plan_key === plan.plan_key;
              return (
                <Pressable
                  key={plan.id}
                  style={[
                    styles.planOption,
                    { borderColor: colors.border },
                    isSelected && { borderColor: colors.primary, backgroundColor: colors.accentBlueBg },
                  ]}
                  onPress={() => setSelectedPlanKey(plan.plan_key)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.planName, { color: colors.textPrimary }, isSelected && { color: colors.primary }]}>
                        {plan.name}
                      </Text>
                      {isCurrent && (
                        <View style={[styles.badge, { backgroundColor: colors.accentBlueBg }]}>
                          <Text style={[styles.badgeText, { color: colors.primary }]}>현재</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.planDetail, { color: colors.textSecondary }]}>
                      {plan.price_monthly > 0
                        ? `\u20A9${plan.price_monthly.toLocaleString()}/월`
                        : '무료'
                      }
                      {' \u00B7 '}학생 {plan.max_students}명
                      {' \u00B7 '}스크립트 {plan.max_scripts >= 9999 ? '무제한' : `${plan.max_scripts}개`}
                    </Text>
                  </View>
                  <View style={[styles.radioOuter, { borderColor: colors.border }, isSelected && { borderColor: colors.primary }]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                  </View>
                </Pressable>
              );
            })}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowPlanModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }, isChangingPlan && { opacity: 0.7 }]}
                onPress={handleChangePlan}
                disabled={isChangingPlan || !selectedPlanKey}
              >
                {isChangingPlan ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {subscription ? '변경' : '생성'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* 학원 삭제 모달 */}
      {/* ================================================================== */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Ionicons name="warning" size={32} color={colors.error} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[styles.modalTitle, { color: colors.error }]}>학원 삭제</Text>
            <Text style={[styles.deleteWarning, { color: colors.textSecondary }]}>
              이 작업은 되돌릴 수 없습니다.{'\n'}
              구독, 멤버, 반, 초대 코드가 모두 삭제됩니다.{'\n'}
              스크립트와 연습 기록은 보존됩니다.
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary }]}
              value={deleteReason}
              onChangeText={setDeleteReason}
              placeholder="삭제 사유 (선택)"
              placeholderTextColor={colors.textDisabled}
              multiline
              numberOfLines={2}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => { setShowDeleteModal(false); setDeleteReason(''); }}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDeleteBtn, { backgroundColor: colors.error }, isDeleting && { opacity: 0.7 }]}
                onPress={handleDeleteOrg}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>삭제</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Pretendard-Bold' },
  content: { padding: 16, paddingBottom: 40 },
  errorText: { fontSize: 14, fontFamily: 'Pretendard-Medium', marginBottom: 12 },

  // 카드
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Regular', marginTop: 8 },

  // 학원 정보
  orgInfoRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  orgNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  orgIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgName: { fontSize: 18, fontFamily: 'Pretendard-Bold' },
  orgMeta: { fontSize: 13, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontFamily: 'Pretendard-Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Pretendard-Medium', marginTop: 2 },

  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    marginTop: 20,
    marginBottom: 12,
  },

  // 구독
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subPlan: { fontSize: 16, fontFamily: 'Pretendard-SemiBold' },
  subPeriod: { fontSize: 13, fontFamily: 'Pretendard-Regular', marginTop: 6 },
  subActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  subActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  subActionText: { fontSize: 13, fontFamily: 'Pretendard-Medium' },

  // 뱃지
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontFamily: 'Pretendard-Medium' },

  // 액션 버튼
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Pretendard-SemiBold' },

  // 멤버
  memberCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  memberMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },
  memberEmail: { fontSize: 12, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  memberDate: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 8 },

  // 결제
  paymentCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  paymentMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentAmount: { fontSize: 15, fontFamily: 'Pretendard-Bold' },
  paymentDate: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  payBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  payBadgeText: { fontSize: 10, fontFamily: 'Pretendard-Bold', color: '#FFFFFF' },
  paymentMeta: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 6 },
  failureText: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 4 },

  // 학원 삭제
  deleteOrgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteOrgText: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },

  // 모달 공통
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalCancelText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  modalConfirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', color: '#FFFFFF' },
  modalDeleteBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },

  // 플랜 선택
  planOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  planName: { fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
  planDetail: { fontSize: 12, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // 삭제 경고
  deleteWarning: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 20,
    marginBottom: 16,
  },
});
