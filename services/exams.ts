import { supabase, invokeFunction } from '@/lib/supabase';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';
import { uploadRecording, transcribeAudio } from '@/services/practices';
import { getUserMessage } from '@/lib/errors';
import { TOPIC_CATEGORIES } from '@/lib/constants';
import type {
  ExamType,
  ExamSession,
  ExamResponse,
  ExamSessionListItem,
  ExamEvaluationReport,
  RoleplayScenario,
  RoleplayScenarioQuestion,
  ExamRecording,
  Topic,
} from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export interface GeneratedQuestion {
  question_order: number;
  question_id?: string;
  roleplay_question_id?: string;
  question_text: string;
  question_type: string;
  is_scored: boolean;
  combo_number: number | null;
  combo_position: number | null;
  source: 'question' | 'roleplay_question';
  audio_url?: string | null;
}

interface ExamAvailability {
  success: boolean;
  exams_remaining?: number;
  whisper_remaining?: number;
  error?: string;
  needed?: number;
}

// ============================================================================
// Helpers
// 새 테이블(exam_sessions, exam_responses, roleplay_scenarios, roleplay_scenario_questions)은
// database.types.ts에 아직 없으므로 .from() 호출 시 타입 캐스팅 필요
// supabase db push + supabase gen types 실행 후 제거 가능
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (table: string) => (supabase as any).from(table);

// ============================================================================
// 세션 관리
// ============================================================================

/**
 * 시험 세션 생성
 */
export async function createExamSession(params: {
  examType: ExamType;
  selfAssessmentLevel?: number;
  surveyTopics?: string[];
  roleplayScenarioId?: string;
  organizationId?: string;
  questions: GeneratedQuestion[];
}): Promise<{ data: { sessionId: string } | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  // 세션 생성
  const { data: session, error: sessionError } = await fromTable('exam_sessions')
    .insert({
      student_id: user.id,
      organization_id: params.organizationId || null,
      exam_type: params.examType,
      self_assessment_level: params.selfAssessmentLevel || null,
      survey_topics: params.surveyTopics || null,
      roleplay_scenario_id: params.roleplayScenarioId || null,
      status: 'in_progress',
      processing_status: 'pending',
    })
    .select('id')
    .single();

  if (sessionError) {
    return { data: null, error: classifyError(sessionError, { resource: 'exam_session' }) };
  }

  // 응답 행 일괄 생성
  const responses = params.questions.map(q => ({
    exam_session_id: session.id,
    question_id: q.source === 'question' ? q.question_id : null,
    roleplay_question_id: q.source === 'roleplay_question' ? q.roleplay_question_id : null,
    question_order: q.question_order,
    combo_number: q.combo_number,
    combo_position: q.combo_position,
    is_scored: q.is_scored,
    processing_status: 'pending',
  }));

  const { error: responsesError } = await fromTable('exam_responses')
    .insert(responses);

  if (responsesError) {
    return { data: null, error: classifyError(responsesError, { resource: 'exam_response' }) };
  }

  return { data: { sessionId: session.id }, error: null };
}

/**
 * 시험 세션 조회
 */
export async function getExamSession(sessionId: string): Promise<{
  data: (ExamSession & { responses: ExamResponse[] }) | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data: session, error: sessionError } = await fromTable('exam_sessions')
    .select(`
      id, student_id, organization_id, exam_type, self_assessment_level,
      status, survey_topics, roleplay_scenario_id,
      started_at, completed_at, total_duration_sec,
      estimated_grade, score_function, score_accuracy, score_content, score_text_type, overall_score,
      evaluation_report, processing_status, created_at, deleted_at
    `)
    .eq('id', sessionId)
    .is('deleted_at', null)
    .single();

  if (sessionError) {
    return { data: null, error: classifyError(sessionError, { resource: 'exam_session' }) };
  }

  const { data: responses, error: responsesError } = await fromTable('exam_responses')
    .select(`
      id, exam_session_id, question_id, roleplay_question_id,
      question_order, combo_number, combo_position,
      audio_url, duration_sec, transcription, score,
      processing_status, is_scored, created_at
    `)
    .eq('exam_session_id', sessionId)
    .order('question_order', { ascending: true });

  if (responsesError) {
    return { data: null, error: classifyError(responsesError, { resource: 'exam_response' }) };
  }

  return {
    data: { ...session, responses: responses || [] } as ExamSession & { responses: ExamResponse[] },
    error: null,
  };
}

/**
 * 내 시험 세션 목록 조회
 */
export async function getMyExamSessions(examType?: ExamType): Promise<{
  data: ExamSessionListItem[];
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: new AppError('AUTH_REQUIRED') };

  let query = fromTable('exam_sessions')
    .select('id, exam_type, status, estimated_grade, overall_score, started_at, completed_at, total_duration_sec')
    .eq('student_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (examType) {
    query = query.eq('exam_type', examType);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: classifyError(error, { resource: 'exam_session' }) };
  }

  return { data: (data || []) as ExamSessionListItem[], error: null };
}

/**
 * 학생의 시험 세션 목록 조회 (강사용)
 * RLS exam_sessions_select_teacher 정책이 teacher_student 관계를 검증
 */
export async function getStudentExamSessions(studentId: string): Promise<{
  data: ExamSessionListItem[];
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await fromTable('exam_sessions')
    .select('id, exam_type, status, estimated_grade, overall_score, started_at, completed_at, total_duration_sec')
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: classifyError(error, { resource: 'exam_session' }) };
  }

  return { data: (data || []) as ExamSessionListItem[], error: null };
}

/**
 * 시험 포기 (abandoned)
 */
export async function abandonExamSession(sessionId: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new AppError('AUTH_REQUIRED') };

  const { error } = await fromTable('exam_sessions')
    .update({
      status: 'abandoned',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('status', 'in_progress');

  if (error) {
    return { error: classifyError(error, { resource: 'exam_session' }) };
  }
  return { error: null };
}

/**
 * 시험 세션 소프트 삭제 (강사/원장 전용)
 * RPC soft_delete_exam_sessions: 연결된 학생 또는 같은 조직 시험만 삭제 가능
 */
export async function deleteExamSessions(sessionIds: string[]): Promise<{
  success: boolean;
  deletedCount: number;
  error: string | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, deletedCount: 0, error: '로그인이 필요합니다.' };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'soft_delete_exam_sessions',
    { p_session_ids: sessionIds },
  );

  if (error) {
    return { success: false, deletedCount: 0, error: getUserMessage(classifyError(error, { resource: 'exam_session' })) };
  }

  if (!data?.success) {
    return { success: false, deletedCount: 0, error: classifyRpcError(data?.error, { resource: 'exam_session' }).userMessage };
  }

  return { success: true, deletedCount: data.deleted_count ?? 0, error: null };
}

// ============================================================================
// 응답 저장
// ============================================================================

/**
 * 시험 응답 저장 (녹음 URL + 소요시간)
 */
export async function saveExamResponse(params: {
  examSessionId: string;
  questionOrder: number;
  audioUrl: string;
  durationSec: number;
}): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new AppError('AUTH_REQUIRED') };

  const { error } = await fromTable('exam_responses')
    .update({
      audio_url: params.audioUrl,
      duration_sec: params.durationSec,
    })
    .eq('exam_session_id', params.examSessionId)
    .eq('question_order', params.questionOrder);

  if (error) {
    return { error: classifyError(error, { resource: 'exam_response' }) };
  }
  return { error: null };
}

// ============================================================================
// 시험 종료 후 처리 (핵심)
// ============================================================================

/**
 * 시험 결과 처리
 * 1. 녹음 파일 순차 업로드
 * 2. STT 순차 처리 (500ms 간격)
 * 3. claude-exam-evaluate 호출 (배치 1회)
 */
export async function processExamResults(
  sessionId: string,
  recordings: ExamRecording[],
  onProgress?: (stage: 'upload' | 'stt' | 'evaluate', current: number, total: number) => void,
): Promise<{
  data: ExamEvaluationReport | null;
  error: Error | null;
  partialSttFailures?: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  // 빈 녹음 배열 가드
  if (recordings.length === 0) {
    return { data: null, error: new AppError('EXAM_NO_RECORDINGS') };
  }

  // 세션 상태 사전 확인 (이미 완료/포기/처리 중이면 중복 실행 방지)
  const { data: sessionCheck, error: checkError } = await fromTable('exam_sessions')
    .select('status, processing_status')
    .eq('id', sessionId)
    .is('deleted_at', null)
    .single();

  if (checkError || !sessionCheck) {
    return { data: null, error: new AppError('EXAM_SESSION_NOT_FOUND') };
  }
  if (sessionCheck.status !== 'in_progress') {
    return { data: null, error: new AppError('EXAM_ALREADY_COMPLETED') };
  }
  if (sessionCheck.processing_status !== 'pending') {
    return { data: null, error: new AppError('EXAM_ALREADY_PROCESSING') };
  }

  const total = recordings.length;
  let sttFailures = 0;
  const uploadedOrders = new Set<number>(); // 업로드 성공 추적

  // 1단계: 녹음 업로드
  for (let i = 0; i < recordings.length; i++) {
    const rec = recordings[i];
    onProgress?.('upload', i + 1, total);

    const { data: uploadResult, error: uploadError } = await uploadRecording(
      rec.uri, `exam_${sessionId}_q${rec.questionOrder}`
    );

    if (uploadError || !uploadResult) {
      if (__DEV__) console.warn('[AppError] Upload failed for Q' + rec.questionOrder, uploadError);
      continue;
    }

    uploadedOrders.add(rec.questionOrder);

    // DB에 audio_url 저장
    const { error: audioSaveError } = await fromTable('exam_responses')
      .update({ audio_url: uploadResult.path, duration_sec: Math.round(rec.duration) })
      .eq('exam_session_id', sessionId)
      .eq('question_order', rec.questionOrder);
    if (audioSaveError && __DEV__) console.warn('[AppError] audio_url save failed Q' + rec.questionOrder, audioSaveError);
  }

  // 2단계: STT 순차 처리 (업로드 성공한 녹음만)
  for (let i = 0; i < recordings.length; i++) {
    const rec = recordings[i];
    onProgress?.('stt', i + 1, total);

    // 업로드 실패한 녹음은 STT 건너뛰기 (rate limit 낭비 방지)
    if (!uploadedOrders.has(rec.questionOrder)) {
      sttFailures++;
      continue;
    }

    const audioPath = `${user.id}/exam_${sessionId}_q${rec.questionOrder}.m4a`;
    const { data: sttResult, error: sttError } = await transcribeAudio(audioPath);

    if (sttError || !sttResult) {
      sttFailures++;
      // STT 실패 — transcription NULL 상태로 유지
      // processing_status는 보호 컬럼 (037 트리거) → Edge Function에서만 변경 가능
      // Edge Function은 transcription NULL을 "(No speech / skipped)"로 처리
      if (__DEV__) console.warn('[AppError] STT failed for Q' + rec.questionOrder, sttError);
    } else {
      // 전사 텍스트 저장
      const { error: sttSaveError } = await fromTable('exam_responses')
        .update({ transcription: sttResult.transcription })
        .eq('exam_session_id', sessionId)
        .eq('question_order', rec.questionOrder);
      if (sttSaveError && __DEV__) console.warn('[AppError] transcription save failed Q' + rec.questionOrder, sttSaveError);
    }

    // STT 간격 (429 방지)
    if (i < recordings.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // 전체 STT 실패 시 Claude 평가 호출 방지 (API 비용 낭비 방지)
  if (sttFailures >= recordings.length) {
    return {
      data: null,
      error: new AppError('EXAM_PROCESSING_FAILED'),
      partialSttFailures: sttFailures,
    };
  }

  // 세션 총 소요시간 업데이트
  const totalDuration = recordings.reduce((sum, r) => sum + r.duration, 0);
  const { error: durationError } = await fromTable('exam_sessions')
    .update({ total_duration_sec: Math.round(totalDuration) })
    .eq('id', sessionId);
  if (durationError && __DEV__) console.warn('[AppError] total_duration save failed', durationError);

  // 3단계: Claude 평가 (배치 1회)
  onProgress?.('evaluate', 1, 1);

  try {
    const { data: evalData, error: evalError } = await invokeFunction<{
      estimated_grade: string;
      overall_score: number;
    }>('claude-exam-evaluate', { examSessionId: sessionId });

    if (evalError) {
      return {
        data: null,
        error: classifyError(evalError, { apiType: 'claude' }),
        partialSttFailures: sttFailures > 0 ? sttFailures : undefined,
      };
    }

    return {
      data: evalData as ExamEvaluationReport,
      error: null,
      partialSttFailures: sttFailures > 0 ? sttFailures : undefined,
    };
  } catch (err) {
    return {
      data: null,
      error: classifyError(err, { apiType: 'claude' }),
      partialSttFailures: sttFailures > 0 ? sttFailures : undefined,
    };
  }
}

// ============================================================================
// 콤보 롤플레이
// ============================================================================

/**
 * 롤플레이 시나리오 목록 조회
 */
export async function getRoleplayScenarios(): Promise<{
  data: RoleplayScenario[];
  error: Error | null;
}> {
  const { data, error } = await fromTable('roleplay_scenarios')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return { data: [], error: classifyError(error, { resource: 'roleplay_scenario' }) };
  }

  return { data: (data || []) as RoleplayScenario[], error: null };
}

/**
 * 롤플레이 시나리오 상세 조회 (시나리오 + 3문항)
 */
export async function getRoleplayScenarioDetail(scenarioId: string): Promise<{
  data: { scenario: RoleplayScenario; questions: RoleplayScenarioQuestion[] } | null;
  error: Error | null;
}> {
  const [scenarioResult, questionsResult] = await Promise.all([
    fromTable('roleplay_scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single(),
    fromTable('roleplay_scenario_questions')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('position', { ascending: true }),
  ]);

  if (scenarioResult.error) {
    return { data: null, error: classifyError(scenarioResult.error, { resource: 'roleplay_scenario' }) };
  }

  return {
    data: {
      scenario: scenarioResult.data as RoleplayScenario,
      questions: (questionsResult.data || []) as RoleplayScenarioQuestion[],
    },
    error: null,
  };
}

// ============================================================================
// 문제 생성 (RPC 호출)
// ============================================================================

/**
 * 모의고사 문제 생성
 */
export async function generateMockExamQuestions(
  selfAssessment: number,
  surveyTopicIds: string[],
): Promise<{ data: { questions: GeneratedQuestion[]; totalCount: number } | null; error: Error | null }> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'generate_mock_exam_questions',
    {
      p_self_assessment: selfAssessment,
      p_survey_topic_ids: surveyTopicIds,
    }
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'exam_session' }) };
  }

  const result = data as { success: boolean; questions?: GeneratedQuestion[]; total_count?: number; error?: string };
  if (!result.success) {
    return { data: null, error: result.error ? classifyRpcError(result.error, { resource: 'exam_session' }) : new AppError('EXAM_PROCESSING_FAILED') };
  }

  return {
    data: {
      questions: result.questions || [],
      totalCount: result.total_count || 0,
    },
    error: null,
  };
}

/**
 * 레벨 테스트 문제 생성
 */
export async function generateLevelTestQuestions(): Promise<{
  data: { questions: GeneratedQuestion[]; totalCount: number } | null;
  error: Error | null;
}> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'generate_level_test_questions'
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'exam_session' }) };
  }

  const result = data as { success: boolean; questions?: GeneratedQuestion[]; total_count?: number; error?: string };
  if (!result.success) {
    return { data: null, error: result.error ? classifyRpcError(result.error, { resource: 'exam_session' }) : new AppError('EXAM_PROCESSING_FAILED') };
  }

  return {
    data: {
      questions: result.questions || [],
      totalCount: result.total_count || 0,
    },
    error: null,
  };
}

/**
 * 시험 가능 여부 확인
 */
export async function checkExamAvailability(
  examType: ExamType,
  questionCount?: number,
): Promise<ExamAvailability> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'check_exam_availability',
    {
      p_exam_type: examType,
      p_question_count: questionCount || 15,
    }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'exam_session' }).userMessage };
  }

  const result = data as ExamAvailability;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'exam_session' }).userMessage;
  }

  return result;
}

// ============================================================================
// 토픽 조회 (시험용)
// ============================================================================

/**
 * 서베이 토픽 목록 조회 (모의고사 토픽 선택 화면용)
 */
export async function getSurveyTopics(): Promise<{
  data: (Topic & { topic_groups: { id: string; name_ko: string; selection_type: string; min_selections: number; sort_order: number } | null })[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('topics')
    .select('*, topic_groups(id, name_ko, selection_type, min_selections, sort_order)')
    .eq('category', TOPIC_CATEGORIES.SURVEY)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return { data: [], error: classifyError(error, { resource: 'topic' }) };
  }

  return { data: (data || []) as any, error: null };
}

/**
 * 서베이 토픽 + 전략 메타데이터 조회 (서베이 전략 가이드 화면용)
 */
export async function getTopicsWithStrategy(): Promise<{
  data: Array<Topic & { strategy_group: string | null; difficulty_hint: number | null; strategy_tip_ko: string | null }>;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('topics')
    .select('*, strategy_group, difficulty_hint, strategy_tip_ko')
    .eq('category', TOPIC_CATEGORIES.SURVEY)
    .eq('is_active', true)
    .order('strategy_group', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    return { data: [], error: classifyError(error, { resource: 'topic' }) };
  }

  return { data: (data || []) as any, error: null };
}
