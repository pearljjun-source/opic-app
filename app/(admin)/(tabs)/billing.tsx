import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable,
  RefreshControl, Modal, TextInput, Switch, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import {
  adminGetSubscriptionStats,
  adminGetPaymentHistory,
  getSubscriptionPlans,
  adminUpdatePlan,
} from '@/services/billing';
import type { SubscriptionStats, SubscriptionPlan, PaymentRecord } from '@/lib/types';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  paid: { text: '완료', color: COLORS.SUCCESS },
  pending: { text: '대기', color: COLORS.WARNING },
  failed: { text: '실패', color: COLORS.ERROR },
  refunded: { text: '환불', color: COLORS.GRAY_500 },
  canceled: { text: '취소', color: COLORS.GRAY_400 },
};

export default function AdminBillingScreen() {
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 플랜 편집 모달 state
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    price_monthly: '',
    price_yearly: '',
    max_students: '',
    max_scripts: '',
    ai_feedback_enabled: false,
    tts_enabled: false,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);

    const [statsResult, plansResult, paymentsResult] = await Promise.all([
      adminGetSubscriptionStats(),
      getSubscriptionPlans(),
      adminGetPaymentHistory({ limit: 20 }),
    ]);

    if (statsResult.error) {
      setError(getUserMessage(statsResult.error));
    } else {
      setStats(statsResult.data);
    }

    if (plansResult.data) setPlans(plansResult.data);
    if (paymentsResult.data) setPayments(paymentsResult.data);

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

  const formatCurrency = (amount: number) =>
    `\u20A9${amount.toLocaleString()}`;

  const handleOpenEdit = useCallback((plan: SubscriptionPlan) => {
    setEditForm({
      name: plan.name,
      price_monthly: String(plan.price_monthly),
      price_yearly: String(plan.price_yearly),
      max_students: String(plan.max_students),
      max_scripts: String(plan.max_scripts),
      ai_feedback_enabled: plan.ai_feedback_enabled,
      tts_enabled: plan.tts_enabled,
    });
    setEditPlan(plan);
  }, []);

  const handleSavePlan = useCallback(async () => {
    if (!editPlan) return;
    setIsUpdating(true);

    const updates: Record<string, unknown> = {};
    const trimmedName = editForm.name.trim();
    if (trimmedName && trimmedName !== editPlan.name) updates.name = trimmedName;

    const monthly = parseInt(editForm.price_monthly, 10);
    if (!isNaN(monthly) && monthly !== editPlan.price_monthly) updates.price_monthly = monthly;

    const yearly = parseInt(editForm.price_yearly, 10);
    if (!isNaN(yearly) && yearly !== editPlan.price_yearly) updates.price_yearly = yearly;

    const students = parseInt(editForm.max_students, 10);
    if (!isNaN(students) && students !== editPlan.max_students) updates.max_students = students;

    const scripts = parseInt(editForm.max_scripts, 10);
    if (!isNaN(scripts) && scripts !== editPlan.max_scripts) updates.max_scripts = scripts;

    if (Object.keys(updates).length === 0
      && editForm.ai_feedback_enabled === editPlan.ai_feedback_enabled
      && editForm.tts_enabled === editPlan.tts_enabled) {
      setEditPlan(null);
      setIsUpdating(false);
      return;
    }

    const { error: updateError } = await adminUpdatePlan(editPlan.id, updates);
    if (updateError) {
      Alert.alert('오류', getUserMessage(updateError));
    } else {
      setEditPlan(null);
      await fetchData();
    }
    setIsUpdating(false);
  }, [editPlan, editForm, fetchData]);

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
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* 구독 통계 */}
        <Text style={styles.sectionTitle}>구독 통계</Text>
        <View style={styles.statRow}>
          <StatCard label="MRR" value={formatCurrency(stats?.mrr ?? 0)} />
          <StatCard label="구독자" value={stats?.total_subscribers ?? 0} />
        </View>
        <View style={styles.statRow}>
          <StatCard label="ARR" value={formatCurrency(stats?.arr ?? 0)} />
          <StatCard label="이탈률" value={`${((stats?.churn_rate ?? 0) * 100).toFixed(1)}%`} />
        </View>

        {/* 플랜 관리 */}
        <Text style={styles.sectionTitle}>플랜 관리</Text>
        {plans.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.planHeaderRight}>
                <Text style={styles.planPrice}>{formatCurrency(plan.price_monthly)}/월</Text>
                <Pressable onPress={() => handleOpenEdit(plan)} hitSlop={8}>
                  <Ionicons name="create-outline" size={18} color={COLORS.PRIMARY} />
                </Pressable>
              </View>
            </View>
            <View style={styles.planDetails}>
              <Text style={styles.planDetail}>학생 {plan.max_students}명</Text>
              <Text style={styles.planDetail}>스크립트 {plan.max_scripts >= 9999 ? '무제한' : `${plan.max_scripts}개`}</Text>
              {plan.ai_feedback_enabled && <Text style={styles.planDetail}>AI 피드백</Text>}
              {plan.tts_enabled && <Text style={styles.planDetail}>TTS</Text>}
            </View>
          </View>
        ))}

        {/* 최근 결제 */}
        <Text style={styles.sectionTitle}>최근 결제</Text>
        {payments.map((payment) => {
          const status = STATUS_LABELS[payment.status] || { text: payment.status, color: COLORS.GRAY_400 };
          return (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.paymentMain}>
                <View>
                  <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                  <Text style={styles.paymentDate}>
                    {new Date(payment.created_at).toLocaleDateString('ko-KR')}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                  <Text style={styles.statusText}>{status.text}</Text>
                </View>
              </View>
              {payment.card_last4 && (
                <Text style={styles.paymentMeta}>**** {payment.card_last4}</Text>
              )}
              {payment.failure_reason && (
                <Text style={styles.failureText}>{payment.failure_reason}</Text>
              )}
            </View>
          );
        })}
        {payments.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>결제 내역이 없습니다</Text>
          </View>
        )}
      </ScrollView>

      {/* 플랜 편집 모달 */}
      <Modal
        visible={!!editPlan}
        transparent
        animationType="fade"
        onRequestClose={() => setEditPlan(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>플랜 수정</Text>
              <Text style={styles.modalSubtitle}>
                {editPlan?.plan_key} 플랜의 설정을 변경합니다.
              </Text>

              <Text style={styles.inputLabel}>플랜 이름</Text>
              <TextInput
                style={styles.input}
                value={editForm.name}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, name: v }))}
                placeholder="플랜 이름"
                placeholderTextColor={COLORS.GRAY_400}
                maxLength={100}
              />

              <Text style={styles.inputLabel}>월간 가격 (원)</Text>
              <TextInput
                style={styles.input}
                value={editForm.price_monthly}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, price_monthly: v }))}
                placeholder="0"
                placeholderTextColor={COLORS.GRAY_400}
                keyboardType="number-pad"
              />

              <Text style={styles.inputLabel}>연간 가격 (원)</Text>
              <TextInput
                style={styles.input}
                value={editForm.price_yearly}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, price_yearly: v }))}
                placeholder="0"
                placeholderTextColor={COLORS.GRAY_400}
                keyboardType="number-pad"
              />

              <Text style={styles.inputLabel}>최대 학생 수</Text>
              <TextInput
                style={styles.input}
                value={editForm.max_students}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, max_students: v }))}
                placeholder="5"
                placeholderTextColor={COLORS.GRAY_400}
                keyboardType="number-pad"
              />

              <Text style={styles.inputLabel}>최대 스크립트 수</Text>
              <TextInput
                style={styles.input}
                value={editForm.max_scripts}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, max_scripts: v }))}
                placeholder="10"
                placeholderTextColor={COLORS.GRAY_400}
                keyboardType="number-pad"
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>AI 피드백</Text>
                <Switch
                  value={editForm.ai_feedback_enabled}
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, ai_feedback_enabled: v }))}
                  trackColor={{ false: COLORS.GRAY_200, true: COLORS.PRIMARY }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>TTS</Text>
                <Switch
                  value={editForm.tts_enabled}
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, tts_enabled: v }))}
                  trackColor={{ false: COLORS.GRAY_200, true: COLORS.PRIMARY }}
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancel}
                  onPress={() => setEditPlan(null)}
                >
                  <Text style={styles.modalCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmit, isUpdating && styles.modalSubmitDisabled]}
                  onPress={handleSavePlan}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color={COLORS.WHITE} />
                  ) : (
                    <Text style={styles.modalSubmitText}>저장</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BACKGROUND_SECONDARY },
  errorText: { color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium', marginBottom: 12 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 20,
    marginBottom: 12,
  },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  statLabel: { fontSize: 12, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY, marginBottom: 4 },
  statValue: { fontSize: 20, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  planCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  planHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planName: { fontSize: 15, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  planPrice: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', color: COLORS.PRIMARY },
  planDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planDetail: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
    backgroundColor: COLORS.GRAY_100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  paymentMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentAmount: { fontSize: 15, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  paymentDate: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontFamily: 'Pretendard-Bold', color: COLORS.WHITE },
  paymentMeta: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400, marginTop: 6 },
  failureText: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.ERROR, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },

  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { backgroundColor: COLORS.WHITE, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginBottom: 16 },
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_PRIMARY },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.GRAY_100 },
  modalCancelText: { fontSize: 15, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },
  modalSubmit: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.PRIMARY },
  modalSubmitDisabled: { opacity: 0.5 },
  modalSubmitText: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: COLORS.WHITE },
});
