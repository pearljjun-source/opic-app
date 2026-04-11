import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useExamRoutes } from '@/hooks/useExamRoutes';
import { EXAM_TYPE_LABELS, ACTFL_DIMENSIONS } from '@/lib/constants';
import { getExamSession } from '@/services/exams';
import { getUserMessage } from '@/lib/errors';
import { alert as xAlert } from '@/lib/alert';
import type { ExamSession, ExamResponse, ExamEvaluationReport } from '@/lib/types';

export default function ExamResultScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const routes = useExamRoutes();
  const { sessionId, viewMode } = useLocalSearchParams<{ sessionId: string; viewMode?: string }>();

  const [session, setSession] = useState<(ExamSession & { responses: ExamResponse[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const POLL_INTERVAL_MS = 3000;
  const MAX_POLLS = 20; // 60초

  const fetchSession = useCallback(async () => {
    if (!sessionId) return null;
    const { data, error } = await getExamSession(sessionId);
    if (error) {
      xAlert('오류', getUserMessage(error));
      return null;
    }
    return data;
  }, [sessionId]);

  // 초기 로드
  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }
    (async () => {
      const data = await fetchSession();
      if (data) setSession(data);
      setIsLoading(false);
    })();
  }, [sessionId, fetchSession]);

  // 처리 중일 때 폴링
  useEffect(() => {
    const status = session?.processing_status;
    if (status !== 'pending' && status !== 'processing') return;

    pollCountRef.current = 0;
    setIsTimedOut(false);

    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setIsTimedOut(true);
        return;
      }
      const data = await fetchSession();
      if (data) {
        setSession(data);
        if (data.processing_status !== 'pending' && data.processing_status !== 'processing') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [session?.processing_status, fetchSession]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>결과를 불러올 수 없습니다.</Text>
      </View>
    );
  }

  const report = session.evaluation_report;
  const isProcessing = session.processing_status === 'processing' || session.processing_status === 'pending';
  const isFailed = session.processing_status === 'failed';

  const handleRetry = async () => {
    setIsTimedOut(false);
    setIsLoading(true);
    const data = await fetchSession();
    if (data) setSession(data);
    setIsLoading(false);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* 등급 카드 */}
      <View style={[styles.gradeCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.examType, { color: colors.textSecondary }]}>
          {EXAM_TYPE_LABELS[session.exam_type]}
        </Text>

        {isTimedOut ? (
          <View style={styles.processingState}>
            <Ionicons name="time-outline" size={24} color={colors.warning} />
            <Text style={[styles.processingText, { color: colors.textSecondary }]}>평가 시간이 오래 걸리고 있습니다.</Text>
            <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>새로고침</Text>
            </Pressable>
          </View>
        ) : isFailed ? (
          <View style={styles.processingState}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
            <Text style={[styles.processingText, { color: colors.error }]}>AI 평가 처리에 실패했습니다.</Text>
            <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>다시 확인</Text>
            </Pressable>
          </View>
        ) : isProcessing ? (
          <View style={styles.processingState}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.processingText, { color: colors.textSecondary }]}>AI 평가 처리 중...</Text>
          </View>
        ) : session.estimated_grade ? (
          <>
            <View style={[styles.gradeBigBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.gradeBigText, { color: colors.primary }]}>{session.estimated_grade}</Text>
            </View>
            {session.overall_score != null && (
              <Text style={[styles.overallScore, { color: colors.textSecondary }]}>
                종합 점수: {session.overall_score}/100
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.noGrade, { color: colors.textDisabled }]}>등급 미산출</Text>
        )}
      </View>

      {/* ACTFL 4차원 점수 */}
      {!isProcessing && (session.score_function !== null || report) && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>ACTFL 4차원 분석</Text>
          {Object.values(ACTFL_DIMENSIONS).map((dim) => {
            const score = session[dim.key as keyof ExamSession] as number | null;
            if (score === null || score === undefined) return null;
            return (
              <View key={dim.key} style={styles.dimensionRow}>
                <Text style={[styles.dimensionLabel, { color: colors.textSecondary }]}>{dim.label_ko}</Text>
                <View style={[styles.barBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${score}%` }]} />
                </View>
                <Text style={[styles.dimensionScore, { color: colors.textPrimary }]}>{score}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* AI 종합 평가 */}
      {report && (
        <>
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>종합 평가</Text>
            <Text style={[styles.reportText, { color: colors.textSecondary }]}>{report.summary_ko}</Text>

            {report.grade_justification && (
              <>
                <Text style={[styles.subTitle, { color: colors.textPrimary }]}>등급 판정 근거</Text>
                <Text style={[styles.reportText, { color: colors.textSecondary }]}>{report.grade_justification}</Text>
              </>
            )}
          </View>

          {/* 강점 */}
          {report.key_strengths && report.key_strengths.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>강점</Text>
              {report.key_strengths.map((s, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 개선 사항 */}
          {report.priority_improvements && report.priority_improvements.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>우선 개선 사항</Text>
              {report.priority_improvements.map((item, i) => (
                <View key={i} style={styles.improvementItem}>
                  <Text style={[styles.improvementArea, { color: colors.textPrimary }]}>{item.area}</Text>
                  <Text style={[styles.improvementTip, { color: colors.textSecondary }]}>{item.tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 학습 추천 */}
          {report.study_plan && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>학습 추천</Text>
              <Text style={[styles.reportText, { color: colors.textSecondary }]}>{report.study_plan}</Text>
            </View>
          )}

          {/* 문항별 상세 */}
          {report.per_question && report.per_question.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>문항별 상세</Text>
              {report.per_question.map((pq, idx) => {
                const isExpanded = expandedQuestion === idx;
                return (
                  <Pressable
                    key={idx}
                    style={[styles.questionCard, { borderColor: colors.border }]}
                    onPress={() => setExpandedQuestion(isExpanded ? null : idx)}
                  >
                    <View style={styles.questionHeader}>
                      <Text style={[styles.questionNum, { color: colors.textPrimary }]}>Q{idx + 1}</Text>
                      <Text style={[styles.questionScore, { color: colors.primary }]}>{pq.score ?? '-'}점</Text>
                      <Text style={[styles.questionGrade, { color: colors.textSecondary }]}>{pq.level_indicator ?? ''}</Text>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDisabled} />
                    </View>

                    {isExpanded && (
                      <View style={styles.questionDetail}>
                        {pq.strengths?.length > 0 && (
                          <View style={styles.detailGroup}>
                            <Text style={[styles.detailLabel, { color: colors.success }]}>강점</Text>
                            {pq.strengths.map((s, i) => (
                              <Text key={i} style={[styles.detailText, { color: colors.textSecondary }]}>- {s}</Text>
                            ))}
                          </View>
                        )}
                        {pq.improvements?.length > 0 && (
                          <View style={styles.detailGroup}>
                            <Text style={[styles.detailLabel, { color: colors.warning }]}>개선점</Text>
                            {pq.improvements.map((s, i) => (
                              <Text key={i} style={[styles.detailText, { color: colors.textSecondary }]}>- {s}</Text>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* 하단 버튼 */}
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => viewMode === 'student' ? router.back() : router.push(routes.history as any)}
        >
          <Ionicons name={viewMode === 'student' ? 'arrow-back' : 'list-outline'} size={18} color={colors.textPrimary} />
          <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
            {viewMode === 'student' ? '돌아가기' : '기록 보기'}
          </Text>
        </Pressable>
        {viewMode !== 'student' && (
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.replace(routes.examHub as any)}
          >
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>다시 도전</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24, paddingBottom: 48 },
  errorText: { marginTop: 12, fontSize: 16 },
  gradeCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
  },
  examType: { fontSize: 14, fontFamily: 'Pretendard-Medium', marginBottom: 16 },
  gradeBigBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gradeBigText: { fontSize: 28, fontFamily: 'Pretendard-Bold' },
  overallScore: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
  noGrade: { fontSize: 16, fontFamily: 'Pretendard-Medium', marginVertical: 20 },
  processingState: { alignItems: 'center', gap: 8, marginVertical: 20 },
  processingText: { fontSize: 14, fontFamily: 'Pretendard-Medium', textAlign: 'center' },
  retryButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryButtonText: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', color: '#FFFFFF' },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Pretendard-Bold', marginBottom: 14 },
  subTitle: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', marginTop: 14, marginBottom: 6 },
  reportText: { fontSize: 14, fontFamily: 'Pretendard-Regular', lineHeight: 22 },
  dimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dimensionLabel: { width: 80, fontSize: 13, fontFamily: 'Pretendard-Medium' },
  barBg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', marginHorizontal: 10 },
  barFill: { height: '100%', borderRadius: 4 },
  dimensionScore: { width: 30, fontSize: 13, fontFamily: 'Pretendard-SemiBold', textAlign: 'right' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  bulletText: { flex: 1, fontSize: 14, fontFamily: 'Pretendard-Regular', lineHeight: 20 },
  improvementItem: { marginBottom: 12 },
  improvementArea: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', marginBottom: 2 },
  improvementTip: { fontSize: 13, fontFamily: 'Pretendard-Regular', lineHeight: 20 },
  questionCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  questionNum: { fontSize: 14, fontFamily: 'Pretendard-Bold', width: 30 },
  questionScore: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },
  questionGrade: { flex: 1, fontSize: 13, fontFamily: 'Pretendard-Medium' },
  questionDetail: { marginTop: 12 },
  detailGroup: { marginBottom: 8 },
  detailLabel: { fontSize: 13, fontFamily: 'Pretendard-SemiBold', marginBottom: 4 },
  detailText: { fontSize: 13, fontFamily: 'Pretendard-Regular', lineHeight: 18, marginLeft: 4 },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
});
