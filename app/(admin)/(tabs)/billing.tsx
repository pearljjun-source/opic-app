import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable,
  RefreshControl, Modal, TextInput, Switch, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getUserMessage } from '@/lib/errors';
import {
  adminGetSubscriptionStats,
  adminGetPaymentHistory,
  getSubscriptionPlans,
  adminUpdatePlan,
} from '@/services/billing';
import type { SubscriptionStats, SubscriptionPlan, PaymentRecord } from '@/lib/types';

export default function AdminBillingScreen() {
  const colors = useThemeColors();

  const STATUS_LABELS: Record<string, { text: string; color: string }> = {
    paid: { text: '완료', color: colors.success },
    pending: { text: '대기', color: colors.warning },
    failed: { text: '실패', color: colors.error },
    refunded: { text: '환불', color: colors.gray500 },
    canceled: { text: '취소', color: colors.gray400 },
  };

  function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      </View>
    );
  }

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
        {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

        {/* 구독 통계 */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>구독 통계</Text>
        <View style={styles.statRow}>
          <StatCard label="MRR" value={formatCurrency(stats?.mrr ?? 0)} />
          <StatCard label="구독자" value={stats?.total_subscribers ?? 0} />
        </View>
        <View style={styles.statRow}>
          <StatCard label="ARR" value={formatCurrency(stats?.arr ?? 0)} />
          <StatCard label="이탈률" value={`${((stats?.churn_rate ?? 0) * 100).toFixed(1)}%`} />
        </View>

        {/* 플랜 관리 */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>플랜 관리</Text>
        {plans.map((plan) => (
          <View key={plan.id} style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.planHeader}>
              <Text style={[styles.planName, { color: colors.textPrimary }]}>{plan.name}</Text>
              <View style={styles.planHeaderRight}>
                <Text style={[styles.planPrice, { color: colors.primary }]}>{formatCurrency(plan.price_monthly)}/월</Text>
                <Pressable onPress={() => handleOpenEdit(plan)} hitSlop={8}>
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </Pressable>
              </View>
            </View>
            <View style={styles.planDetails}>
              <Text style={[styles.planDetail, { color: colors.textSecondary, backgroundColor: colors.gray100 }]}>학생 {plan.max_students}명</Text>
              <Text style={[styles.planDetail, { color: colors.textSecondary, backgroundColor: colors.gray100 }]}>스크립트 {plan.max_scripts >= 9999 ? '무제한' : `${plan.max_scripts}개`}</Text>
              {plan.ai_feedback_enabled && <Text style={[styles.planDetail, { color: colors.textSecondary, backgroundColor: colors.gray100 }]}>AI 피드백</Text>}
              {plan.tts_enabled && <Text style={[styles.planDetail, { color: colors.textSecondary, backgroundColor: colors.gray100 }]}>TTS</Text>}
            </View>
          </View>
        ))}

        {/* 최근 결제 */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>최근 결제</Text>
        {payments.map((payment) => {
          const status = STATUS_LABELS[payment.status] || { text: payment.status, color: colors.gray400 };
          return (
            <View key={payment.id} style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.paymentMain}>
                <View>
                  <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>{formatCurrency(payment.amount)}</Text>
                  <Text style={[styles.paymentDate, { color: colors.gray400 }]}>
                    {new Date(payment.created_at).toLocaleDateString('ko-KR')}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                  <Text style={styles.statusText}>{status.text}</Text>
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
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>결제 내역이 없습니다</Text>
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
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>플랜 수정</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {editPlan?.plan_key} 플랜의 설정을 변경합니다.
              </Text>

              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>플랜 이름</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                value={editForm.name}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, name: v }))}
                placeholder="플랜 이름"
                placeholderTextColor={colors.textDisabled}
                maxLength={100}
              />

              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>월간 가격 (원)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                value={editForm.price_monthly}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, price_monthly: v }))}
                placeholder="0"
                placeholderTextColor={colors.textDisabled}
                keyboardType="number-pad"
              />

              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>연간 가격 (원)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                value={editForm.price_yearly}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, price_yearly: v }))}
                placeholder="0"
                placeholderTextColor={colors.textDisabled}
                keyboardType="number-pad"
              />

              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>최대 학생 수</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                value={editForm.max_students}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, max_students: v }))}
                placeholder="5"
                placeholderTextColor={colors.textDisabled}
                keyboardType="number-pad"
              />

              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>최대 스크립트 수</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textPrimary }]}
                value={editForm.max_scripts}
                onChangeText={(v) => setEditForm(prev => ({ ...prev, max_scripts: v }))}
                placeholder="10"
                placeholderTextColor={colors.textDisabled}
                keyboardType="number-pad"
              />

              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>AI 피드백</Text>
                <Switch
                  value={editForm.ai_feedback_enabled}
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, ai_feedback_enabled: v }))}
                  trackColor={{ false: colors.gray200, true: colors.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>TTS</Text>
                <Switch
                  value={editForm.tts_enabled}
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, tts_enabled: v }))}
                  trackColor={{ false: colors.gray200, true: colors.primary }}
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalCancel, { backgroundColor: colors.gray100 }]}
                  onPress={() => setEditPlan(null)}
                >
                  <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmit, { backgroundColor: colors.primary }, isUpdating && styles.modalSubmitDisabled]}
                  onPress={handleSavePlan}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
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
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, fontFamily: 'Pretendard-Medium', marginBottom: 12 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    marginTop: 20,
    marginBottom: 12,
  },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  statLabel: { fontSize: 12, fontFamily: 'Pretendard-Medium', marginBottom: 4 },
  statValue: { fontSize: 20, fontFamily: 'Pretendard-Bold' },
  planCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  planHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planName: { fontSize: 15, fontFamily: 'Pretendard-Bold' },
  planPrice: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },
  planDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planDetail: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  paymentMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentAmount: { fontSize: 15, fontFamily: 'Pretendard-Bold' },
  paymentDate: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontFamily: 'Pretendard-Bold', color: '#FFFFFF' },
  paymentMeta: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 6 },
  failureText: { fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Medium' },

  // 모달
  modalOverlay: { flex: 1, justifyContent: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontFamily: 'Pretendard-Bold', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, fontFamily: 'Pretendard-Regular', marginBottom: 16 },
  inputLabel: { fontSize: 13, fontFamily: 'Pretendard-Medium', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontFamily: 'Pretendard-Medium' },
  modalSubmit: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalSubmitDisabled: { opacity: 0.5 },
  modalSubmitText: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: '#FFFFFF' },
});
