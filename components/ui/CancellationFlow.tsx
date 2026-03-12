import { View, Text, StyleSheet, Pressable, TextInput, Modal } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { CANCELLATION_REASONS } from '@/lib/constants';
import type { CancellationReason, CancellationAction } from '@/lib/types';

interface CancellationFlowProps {
  visible: boolean;
  planName: string;
  studentCount: number;
  scriptCount: number;
  onComplete: (result: {
    reason: CancellationReason;
    detail?: string;
    offerShown?: string;
    offerAccepted: boolean;
    action: CancellationAction;
  }) => void;
  onDismiss: () => void;
}

type Step = 'reason' | 'offer' | 'confirm';

export default function CancellationFlow({
  visible,
  planName,
  studentCount,
  scriptCount,
  onComplete,
  onDismiss,
}: CancellationFlowProps) {
  const colors = useThemeColors();
  const [step, setStep] = useState<Step>('reason');
  const [selectedReason, setSelectedReason] = useState<CancellationReason | null>(null);
  const [detail, setDetail] = useState('');

  const resetAndDismiss = () => {
    setStep('reason');
    setSelectedReason(null);
    setDetail('');
    onDismiss();
  };

  const handleSelectReason = (reason: CancellationReason) => {
    setSelectedReason(reason);
    const reasonConfig = CANCELLATION_REASONS.find(r => r.key === reason);

    if (reasonConfig?.offer === 'none' || reason === 'closing_academy') {
      // 제안 없음 → 바로 확인 단계
      setStep('confirm');
    } else {
      setStep('offer');
    }
  };

  const handleAcceptOffer = () => {
    if (!selectedReason) return;
    const reasonConfig = CANCELLATION_REASONS.find(r => r.key === selectedReason);

    if (reasonConfig?.offer === 'downgrade') {
      onComplete({
        reason: selectedReason,
        detail: detail || undefined,
        offerShown: 'downgrade',
        offerAccepted: true,
        action: 'downgraded',
      });
    } else {
      // feedback 등 → retained
      onComplete({
        reason: selectedReason,
        detail: detail || undefined,
        offerShown: reasonConfig?.offer,
        offerAccepted: true,
        action: 'retained',
      });
    }
    resetAndDismiss();
  };

  const handleConfirmCancel = () => {
    if (!selectedReason) return;
    const reasonConfig = CANCELLATION_REASONS.find(r => r.key === selectedReason);
    onComplete({
      reason: selectedReason,
      detail: detail || undefined,
      offerShown: reasonConfig?.offer !== 'none' ? reasonConfig?.offer : undefined,
      offerAccepted: false,
      action: 'canceled',
    });
    resetAndDismiss();
  };

  const reasonConfig = selectedReason
    ? CANCELLATION_REASONS.find(r => r.key === selectedReason)
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {step === 'reason' ? '구독 취소' : step === 'offer' ? '잠깐만요!' : '정말 취소하시겠습니까?'}
            </Text>
            <Pressable onPress={resetAndDismiss} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Step 1: Reason Selection */}
          {step === 'reason' && (
            <View style={styles.body}>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                취소 사유를 선택해 주세요
              </Text>
              {CANCELLATION_REASONS.map((item) => (
                <Pressable
                  key={item.key}
                  style={[
                    styles.reasonItem,
                    { borderColor: selectedReason === item.key ? colors.primary : colors.border },
                    selectedReason === item.key && { backgroundColor: colors.primaryBg },
                  ]}
                  onPress={() => handleSelectReason(item.key)}
                >
                  <Text style={[
                    styles.reasonText,
                    { color: selectedReason === item.key ? colors.primary : colors.textPrimary },
                  ]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}

              {(selectedReason === 'missing_feature' || selectedReason === 'other') && (
                <TextInput
                  style={[styles.detailInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="자세한 내용을 알려주세요 (선택)"
                  placeholderTextColor={colors.textDisabled}
                  value={detail}
                  onChangeText={setDetail}
                  multiline
                  numberOfLines={3}
                />
              )}
            </View>
          )}

          {/* Step 2: Conditional Offer */}
          {step === 'offer' && reasonConfig && (
            <View style={styles.body}>
              {reasonConfig.offer === 'downgrade' && (
                <>
                  <View style={[styles.impactCard, { backgroundColor: colors.accentRedBg }]}>
                    <Ionicons name="warning" size={20} color={colors.error} />
                    <Text style={[styles.impactText, { color: colors.error }]}>
                      현재 학생 {studentCount}명, 스크립트 {scriptCount}개가{'\n'}
                      이 구독에 포함되어 있습니다.
                    </Text>
                  </View>
                  <Text style={[styles.offerTitle, { color: colors.textPrimary }]}>
                    무료 플랜으로 전환하시겠습니까?
                  </Text>
                  <Text style={[styles.offerDesc, { color: colors.textSecondary }]}>
                    다음 갱신일에 무료 플랜으로 전환됩니다.{'\n'}
                    기존 데이터는 유지되지만 일부 기능이 제한됩니다.
                  </Text>
                  <Pressable
                    style={[styles.offerButton, { backgroundColor: colors.primary }]}
                    onPress={handleAcceptOffer}
                  >
                    <Text style={styles.offerButtonText}>무료 플랜으로 전환</Text>
                  </Pressable>
                </>
              )}

              {reasonConfig.offer === 'feedback' && (
                <>
                  <Text style={[styles.offerTitle, { color: colors.textPrimary }]}>
                    어떤 기능이 필요하신가요?
                  </Text>
                  <Text style={[styles.offerDesc, { color: colors.textSecondary }]}>
                    의견을 남겨주시면 개발 로드맵에 반영하겠습니다.
                  </Text>
                  <TextInput
                    style={[styles.detailInput, { borderColor: colors.border, color: colors.textPrimary }]}
                    placeholder="필요한 기능을 알려주세요"
                    placeholderTextColor={colors.textDisabled}
                    value={detail}
                    onChangeText={setDetail}
                    multiline
                    numberOfLines={3}
                  />
                  <Pressable
                    style={[styles.offerButton, { backgroundColor: colors.primary }]}
                    onPress={handleAcceptOffer}
                  >
                    <Text style={styles.offerButtonText}>의견 제출하고 구독 유지</Text>
                  </Pressable>
                </>
              )}

              <Pressable
                style={[styles.skipButton, { borderColor: colors.border }]}
                onPress={() => setStep('confirm')}
              >
                <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
                  그래도 취소할게요
                </Text>
              </Pressable>
            </View>
          )}

          {/* Step 3: Final Confirmation */}
          {step === 'confirm' && (
            <View style={styles.body}>
              <View style={[styles.impactCard, { backgroundColor: colors.accentRedBg }]}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={[styles.impactText, { color: colors.error }]}>
                  현재 결제 기간이 끝나면 구독이 종료됩니다.{'\n'}
                  {planName} 플랜의 모든 기능을 사용할 수 없게 됩니다.
                </Text>
              </View>

              <Pressable
                style={[styles.cancelConfirmButton, { backgroundColor: colors.error }]}
                onPress={handleConfirmCancel}
              >
                <Text style={styles.cancelConfirmText}>구독 취소 확인</Text>
              </Pressable>

              <Pressable
                style={[styles.keepButton, { borderColor: colors.primary }]}
                onPress={resetAndDismiss}
              >
                <Text style={[styles.keepButtonText, { color: colors.primary }]}>구독 유지하기</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
  },
  body: {
    paddingHorizontal: 20,
    gap: 12,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 4,
  },
  reasonItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  reasonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
  detailInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  impactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    borderRadius: 10,
  },
  impactText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    flex: 1,
    lineHeight: 20,
  },
  offerTitle: {
    fontSize: 17,
    fontFamily: 'Pretendard-Bold',
  },
  offerDesc: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 20,
  },
  offerButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  offerButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#fff',
  },
  skipButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  cancelConfirmButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelConfirmText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#fff',
  },
  keepButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  keepButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
  },
});
