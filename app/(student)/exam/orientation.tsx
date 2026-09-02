import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { useVoiceConsent } from '@/hooks/useVoiceConsent';
import { alert as xAlert } from '@/lib/alert';
import { EXAM_CONFIG, EXAM_TYPE_LABELS } from '@/lib/constants';
import { formatDuration } from '@/lib/helpers';
import type { ExamType } from '@/lib/types';
import { VoiceConsentModal } from '@/components/ui/VoiceConsentModal';

const RULES = [
  {
    icon: 'headset-outline' as const,
    title: '질문 자동 재생',
    desc: '각 문항의 질문 음성이 자동으로 재생됩니다.',
  },
  {
    icon: 'mic-outline' as const,
    title: '자동 녹음 시작',
    desc: '질문 재생이 끝나면 준비 시간 후 녹음이 자동으로 시작됩니다.',
  },
  {
    icon: 'arrow-undo-outline' as const,
    title: '이전 문항 불가',
    desc: '실제 OPIc처럼 이전 문항으로 돌아갈 수 없습니다.',
  },
  {
    icon: 'timer-outline' as const,
    title: '시간 제한',
    desc: '문항별 답변 시간이 제한되며, 초과 시 자동으로 다음 문항으로 넘어갑니다.',
  },
  {
    icon: 'volume-high-outline' as const,
    title: '음성 환경 확인',
    desc: '조용한 환경에서 이어폰/헤드셋 착용을 권장합니다.',
  },
];

export default function ExamOrientationScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const {
    sessionId,
    examType,
    questions,
    scenarioContext,
  } = useLocalSearchParams<{
    sessionId: string;
    examType: string;
    questions: string;
    scenarioContext?: string;
  }>();

  const [countdown, setCountdown] = useState<number | null>(null);

  // 음성 녹음 동의 — 시험 시작 전에 받아둔다 (시험 도중 모달 차단 방지)
  const { consentStatus, showConsentModal, requireConsent, handleAgree, handleDecline } = useVoiceConsent();
  const [consentLoading, setConsentLoading] = useState(false);
  const pendingStartRef = useRef(false);

  const typedExamType = (examType || 'mock_exam') as ExamType;
  const examLabel = EXAM_TYPE_LABELS[typedExamType] || '모의고사';

  let questionCount = 0;
  try {
    if (questions) questionCount = JSON.parse(questions).length;
  } catch {}

  const isMockExam = typedExamType === 'mock_exam';
  const totalTime = isMockExam ? EXAM_CONFIG.MOCK_EXAM_DURATION_SEC : 0;
  const isConsentChecking = consentStatus === 'loading';

  // Countdown before start
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0) {
      navigateToSession();
    }
  }, [countdown]);

  const navigateToSession = () => {
    const params = new URLSearchParams({
      sessionId,
      examType: examType || 'mock_exam',
      questions: questions || '[]',
      autoPlay: 'true',
    });
    if (scenarioContext) params.set('scenarioContext', scenarioContext);
    router.replace(`${routes.session}?${params.toString()}` as any);
  };

  // 동의 완료 후 대기 중이던 시작 요청 재개
  useEffect(() => {
    if (consentStatus === 'agreed' && pendingStartRef.current) {
      pendingStartRef.current = false;
      setCountdown(3);
    }
  }, [consentStatus]);

  const handleStart = () => {
    // 동의 전이면 모달을 띄우고, 동의 완료 시 위 effect가 카운트다운을 시작
    if (!requireConsent()) {
      pendingStartRef.current = true;
      return;
    }
    setCountdown(3);
  };

  if (countdown !== null) {
    return (
      <View style={[styles.countdownContainer, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>시험이 곧 시작됩니다</Text>
        <View style={[styles.countdownCircle, { borderColor: colors.primary }]}>
          <Text style={[styles.countdownNumber, { color: colors.primary }]}>
            {countdown || 'GO'}
          </Text>
        </View>
        <Text style={[styles.countdownHint, { color: colors.textDisabled }]}>
          마이크와 이어폰을 확인하세요
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.examBadge, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="school-outline" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {examLabel} 오리엔테이션
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            시험 시작 전 안내사항을 확인하세요
          </Text>
        </View>

        {/* Exam info */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}>
          <View style={styles.infoRow}>
            <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>문항 수</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{questionCount}문항</Text>
          </View>
          {isMockExam && (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>제한 시간</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{formatDuration(totalTime)}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="speedometer-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>진행 방식</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>자동 진행 (CBT)</Text>
          </View>
        </View>

        {/* Rules */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>시험 안내</Text>
        {RULES.map((rule, i) => (
          <View key={i} style={[styles.ruleItem, { backgroundColor: colors.surface }]}>
            <View style={[styles.ruleIcon, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name={rule.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.ruleContent}>
              <Text style={[styles.ruleTitle, { color: colors.textPrimary }]}>{rule.title}</Text>
              <Text style={[styles.ruleDesc, { color: colors.textSecondary }]}>{rule.desc}</Text>
            </View>
          </View>
        ))}

        {/* Exam structure (mock exam only) */}
        {isMockExam && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>시험 구성</Text>
            <View style={[styles.structureCard, { backgroundColor: colors.surface }]}>
              {[
                { label: 'Q1', desc: '자기소개 (비채점)', color: colors.gray400 },
                { label: 'Q2-Q4', desc: '서베이 토픽 콤보 1', color: colors.success },
                { label: 'Q5-Q7', desc: '서베이 토픽 콤보 2', color: colors.success },
                { label: 'Q8-Q10', desc: '돌발 토픽 콤보', color: colors.warning },
                { label: 'Q11-Q13', desc: '롤플레이 콤보', color: colors.primary },
                { label: 'Q14-Q15', desc: '심화/추가 문항', color: colors.error },
              ].map((item, i) => (
                <View key={i} style={styles.structureRow}>
                  <View style={[styles.structureDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.structureLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                  <Text style={[styles.structureDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>뒤로</Text>
        </Pressable>
        <Pressable
          style={[
            styles.startButton,
            { backgroundColor: colors.primary },
            isConsentChecking && styles.startButtonDisabled,
          ]}
          onPress={handleStart}
          disabled={isConsentChecking}
        >
          <Text style={styles.startButtonText}>
            {isConsentChecking ? '확인 중...' : '시험 시작'}
          </Text>
          {!isConsentChecking && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
        </Pressable>
      </View>

      <VoiceConsentModal
        visible={showConsentModal}
        onAgree={async () => {
          setConsentLoading(true);
          const success = await handleAgree();
          setConsentLoading(false);
          if (!success) {
            pendingStartRef.current = false;
            xAlert('오류', '동의 저장에 실패했습니다. 다시 시도해주세요.');
          }
        }}
        onDecline={() => {
          pendingStartRef.current = false;
          handleDecline();
        }}
        loading={consentLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },

  // Header
  header: { alignItems: 'center', marginBottom: 24 },
  examBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontFamily: 'Pretendard-Bold', marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: 'Pretendard-Regular' },

  // Info card
  infoCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  infoLabel: { flex: 1, fontSize: 14, fontFamily: 'Pretendard-Medium' },
  infoValue: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 12,
  },

  // Rules
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleContent: { flex: 1 },
  ruleTitle: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', marginBottom: 2 },
  ruleDesc: { fontSize: 13, fontFamily: 'Pretendard-Regular', lineHeight: 19 },

  // Structure
  structureCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  structureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  structureDot: { width: 8, height: 8, borderRadius: 4 },
  structureLabel: { fontSize: 13, fontFamily: 'Pretendard-Bold', width: 60 },
  structureDesc: { flex: 1, fontSize: 13, fontFamily: 'Pretendard-Regular' },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  backButtonText: { fontSize: 15, fontFamily: 'Pretendard-Medium' },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButtonDisabled: { opacity: 0.6 },
  startButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Pretendard-SemiBold' },

  // Countdown
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownLabel: {
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 32,
  },
  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  countdownNumber: {
    fontSize: 48,
    fontFamily: 'Pretendard-Bold',
  },
  countdownHint: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },
});
