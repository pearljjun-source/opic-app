import { View, Text, StyleSheet, Pressable, Modal, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';

interface OnboardingWizardProps {
  currentStep: number;
  steps: {
    academy_confirmed: boolean;
    has_teachers: boolean;
    has_classes: boolean;
  };
  onComplete: () => void;
  onSkip: () => void;
  onRefresh: () => void;
}

export default function OnboardingWizard({
  currentStep,
  steps,
  onComplete,
  onSkip,
  onRefresh,
}: OnboardingWizardProps) {
  const colors = useThemeColors();
  const { currentOrg } = useAuth();

  const stepData = [
    {
      number: 1,
      title: '학원 정보 확인',
      description: '학원 이름이 올바른지 확인해주세요.',
      icon: 'business' as const,
      completed: steps.academy_confirmed,
    },
    {
      number: 2,
      title: '강사 초대하기',
      description: '초대 코드를 생성하여 강사를 초대하세요.',
      icon: 'person-add' as const,
      completed: steps.has_teachers,
    },
    {
      number: 3,
      title: '첫 반 만들기',
      description: '반을 만들어 학생들을 관리하세요.',
      icon: 'people' as const,
      completed: steps.has_classes,
    },
  ];

  const allDone = steps.has_teachers && steps.has_classes;

  const handleStepAction = (step: number) => {
    switch (step) {
      case 1:
        // 이미 완료 상태
        break;
      case 2:
        router.push('/invite');
        onRefresh();
        break;
      case 3:
        router.push('/classes');
        onRefresh();
        break;
    }
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      transparent={true}
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
                환영합니다! 🎉
              </Text>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {currentOrg?.name || '학원'} 시작 가이드
              </Text>
            </View>
            <Pressable onPress={onSkip} hitSlop={12}>
              <Text style={[styles.skipText, { color: colors.textDisabled }]}>건너뛰기</Text>
            </Pressable>
          </View>

          {/* Progress */}
          <View style={styles.progressRow}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: stepData[n - 1].completed
                      ? COLORS.PRIMARY
                      : colors.borderLight,
                  },
                ]}
              />
            ))}
          </View>

          {/* Steps */}
          <View style={styles.stepsContainer}>
            {stepData.map((step) => (
              <Pressable
                key={step.number}
                style={[
                  styles.stepCard,
                  {
                    backgroundColor: step.completed ? `${COLORS.PRIMARY}10` : colors.surfaceSecondary,
                    borderColor: step.number === currentStep ? COLORS.PRIMARY : 'transparent',
                    borderWidth: step.number === currentStep ? 1.5 : 0,
                  },
                ]}
                onPress={() => handleStepAction(step.number)}
                disabled={step.completed && step.number !== currentStep}
              >
                <View style={[
                  styles.stepIcon,
                  { backgroundColor: step.completed ? COLORS.PRIMARY : colors.gray200 },
                ]}>
                  {step.completed ? (
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  ) : (
                    <Ionicons name={step.icon} size={18} color={colors.textDisabled} />
                  )}
                </View>

                <View style={styles.stepContent}>
                  <Text style={[
                    styles.stepTitle,
                    { color: step.completed ? colors.textDisabled : colors.textPrimary },
                    step.completed && styles.stepTitleDone,
                  ]}>
                    {step.title}
                  </Text>
                  <Text style={[styles.stepDescription, { color: colors.textDisabled }]}>
                    {step.description}
                  </Text>
                </View>

                {!step.completed && step.number === currentStep && (
                  <Ionicons name="chevron-forward" size={20} color={COLORS.PRIMARY} />
                )}
              </Pressable>
            ))}
          </View>

          {/* Action Button */}
          {allDone ? (
            <Pressable
              style={[styles.completeButton, { backgroundColor: COLORS.PRIMARY }]}
              onPress={onComplete}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>시작하기</Text>
            </Pressable>
          ) : (
            <View style={styles.hintContainer}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textDisabled} />
              <Text style={[styles.hintText, { color: colors.textDisabled }]}>
                각 단계를 눌러 진행하세요. 나중에 해도 됩니다.
              </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 2,
  },
  stepTitleDone: {
    textDecorationLine: 'line-through',
  },
  stepDescription: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
  },
  completeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  completeButtonText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  hintText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
  },
});
