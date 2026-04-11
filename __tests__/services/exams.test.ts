import { mockSupabase } from '../mocks/supabase';
import { AppError } from '@/lib/errors';

// ============================================================================
// Mock Setup
// ============================================================================

jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
  invokeFunction: jest.fn(),
}));

jest.mock('@/services/practices', () => ({
  uploadRecording: jest.fn(),
  transcribeAudio: jest.fn(),
}));

import {
  createExamSession,
  getExamSession,
  getMyExamSessions,
  getStudentExamSessions,
  abandonExamSession,
  saveExamResponse,
  processExamResults,
  getRoleplayScenarios,
  getRoleplayScenarioDetail,
  generateMockExamQuestions,
  generateLevelTestQuestions,
  checkExamAvailability,
  getSurveyTopics,
  getTopicsWithStrategy,
} from '@/services/exams';

import { invokeFunction } from '@/lib/supabase';
import { uploadRecording, transcribeAudio } from '@/services/practices';

const mockInvokeFunction = invokeFunction as jest.MockedFunction<typeof invokeFunction>;
const mockUploadRecording = uploadRecording as jest.MockedFunction<typeof uploadRecording>;
const mockTranscribeAudio = transcribeAudio as jest.MockedFunction<typeof transcribeAudio>;

// ============================================================================
// Helpers
// ============================================================================

const chain = mockSupabase._mockChain;

/** 모든 chain 메서드를 기본 상태(mockReturnThis)로 리셋 */
function resetChain() {
  for (const key of Object.keys(chain)) {
    if (key === 'single' || key === 'maybeSingle') {
      chain[key].mockReset().mockResolvedValue({ data: null, error: null });
    } else {
      chain[key].mockReset().mockReturnThis();
    }
  }
  mockSupabase.from.mockReset().mockReturnValue(chain);
  mockSupabase.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  mockSupabase.auth.getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
}

function mockAuthenticatedUser(userId = 'student-1') {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: userId } },
    error: null,
  });
}

function mockUnauthenticatedUser() {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: null },
    error: null,
  });
}

/**
 * 2개의 eq 호출이 체인되는 경우 (예: .eq('id', x).eq('status', y))
 * 첫 번째 eq는 체인 계속, 두 번째 eq가 터미널
 */
function mockDoubleEqTerminal(result: { data: unknown; error: unknown }) {
  chain.eq
    .mockReturnValueOnce(chain) // 첫 번째 eq: 체인 계속
    .mockResolvedValueOnce(result); // 두 번째 eq: 터미널
}

const sampleQuestions = [
  {
    question_order: 1,
    question_id: 'q1',
    question_text: 'Tell me about yourself',
    question_type: 'describe',
    is_scored: true,
    combo_number: null,
    combo_position: null,
    source: 'question' as const,
  },
  {
    question_order: 2,
    question_id: 'q2',
    question_text: 'Describe your routine',
    question_type: 'routine',
    is_scored: true,
    combo_number: null,
    combo_position: null,
    source: 'question' as const,
  },
];

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => resetChain());

// ============================================================================
// createExamSession
// ============================================================================

describe('createExamSession', () => {
  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await createExamSession({
      examType: 'mock_test',
      questions: sampleQuestions,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('creates session and bulk-inserts responses on success', async () => {
    mockAuthenticatedUser();

    // .insert().select('id').single() → single이 터미널
    chain.single.mockResolvedValueOnce({
      data: { id: 'session-1' },
      error: null,
    });

    // 두 번째 .insert(responses) → await mockChain → error: undefined → 성공
    // (기본 mockReturnThis로 충분)

    const result = await createExamSession({
      examType: 'mock_test',
      selfAssessmentLevel: 4,
      surveyTopics: ['topic-1', 'topic-2'],
      questions: sampleQuestions,
    });

    expect(result.data).toEqual({ sessionId: 'session-1' });
    expect(result.error).toBeNull();
  });

  it('returns classified error on session insert failure', async () => {
    mockAuthenticatedUser();

    chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'DB error' },
    });

    const result = await createExamSession({
      examType: 'mock_test',
      questions: sampleQuestions,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns classified error on responses insert failure', async () => {
    mockAuthenticatedUser();

    // 첫 번째 insert 체인: .insert().select().single() 성공
    chain.single.mockResolvedValueOnce({
      data: { id: 'session-1' },
      error: null,
    });

    // 두 번째 insert: 터미널 (에러 반환)
    chain.insert
      .mockReturnValueOnce(chain) // 첫 번째 insert: 체인 계속
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST000', message: 'Insert failed' } });

    const result = await createExamSession({
      examType: 'mock_test',
      questions: sampleQuestions,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// getExamSession
// ============================================================================

describe('getExamSession', () => {
  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await getExamSession('session-1');

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('returns session with responses on success', async () => {
    mockAuthenticatedUser();

    const session = {
      id: 'session-1',
      student_id: 'student-1',
      exam_type: 'mock_test',
      status: 'completed',
      estimated_grade: 'IH',
      overall_score: 75,
    };
    const responses = [
      { id: 'r1', question_order: 1, transcription: 'Hello', score: 80 },
      { id: 'r2', question_order: 2, transcription: 'My routine', score: 70 },
    ];

    // 첫 번째 쿼리: .select().eq().is().single() → single 터미널
    chain.single.mockResolvedValueOnce({ data: session, error: null });

    // 두 번째 쿼리: .select().eq().order() → order 터미널
    chain.order.mockResolvedValueOnce({ data: responses, error: null });

    const result = await getExamSession('session-1');

    expect(result.data).toEqual({ ...session, responses });
    expect(result.error).toBeNull();
  });

  it('returns classified error on session query failure', async () => {
    mockAuthenticatedUser();

    chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const result = await getExamSession('non-existent');

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns classified error on responses query failure', async () => {
    mockAuthenticatedUser();

    // 세션 조회 성공
    chain.single.mockResolvedValueOnce({
      data: { id: 'session-1', status: 'completed' },
      error: null,
    });

    // 응답 조회 실패
    chain.order.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'Query failed' },
    });

    const result = await getExamSession('session-1');

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// getMyExamSessions
// ============================================================================

describe('getMyExamSessions', () => {
  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await getMyExamSessions();

    expect(result.data).toEqual([]);
    expect(result.error).toBeInstanceOf(AppError);
  });

  it('returns session list on success', async () => {
    mockAuthenticatedUser();

    const sessions = [
      { id: 's1', exam_type: 'mock_test', status: 'completed', estimated_grade: 'IH' },
      { id: 's2', exam_type: 'level_test', status: 'completed', estimated_grade: 'AL' },
    ];

    // .select().eq().is().order() → order 터미널
    chain.order.mockResolvedValueOnce({ data: sessions, error: null });

    const result = await getMyExamSessions();

    expect(result.data).toEqual(sessions);
    expect(result.error).toBeNull();
  });

  it('filters by examType when provided', async () => {
    mockAuthenticatedUser();

    // 체인: .select().eq('student_id').is().order().eq('exam_type')
    // 마지막 eq가 터미널이지만, 첫 번째 eq('student_id')도 있으므로
    // 첫 번째 eq는 체인 계속, 두 번째 eq(examType 필터)가 터미널
    chain.eq
      .mockReturnValueOnce(chain) // eq('student_id') → 체인 계속
      .mockResolvedValueOnce({    // eq('exam_type') → 터미널
        data: [{ id: 's1', exam_type: 'mock_test' }],
        error: null,
      });

    const result = await getMyExamSessions('mock_test');

    expect(result.data).toHaveLength(1);
    expect(result.error).toBeNull();
  });

  it('returns classified error on DB failure', async () => {
    mockAuthenticatedUser();

    chain.order.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'DB error' },
    });

    const result = await getMyExamSessions();

    expect(result.data).toEqual([]);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// getStudentExamSessions
// ============================================================================

describe('getStudentExamSessions', () => {
  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await getStudentExamSessions('student-1');

    expect(result.data).toEqual([]);
    expect(result.error).toBeInstanceOf(AppError);
  });

  it('returns student sessions on success', async () => {
    mockAuthenticatedUser('teacher-1');

    const sessions = [{ id: 's1', exam_type: 'mock_test', status: 'completed' }];

    chain.order.mockResolvedValueOnce({ data: sessions, error: null });

    const result = await getStudentExamSessions('student-1');

    expect(result.data).toEqual(sessions);
    expect(result.error).toBeNull();
  });

  it('returns classified error on DB failure', async () => {
    mockAuthenticatedUser('teacher-1');

    chain.order.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'DB error' },
    });

    const result = await getStudentExamSessions('student-1');

    expect(result.data).toEqual([]);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// abandonExamSession
// ============================================================================

describe('abandonExamSession', () => {
  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await abandonExamSession('session-1');

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('marks session as abandoned on success', async () => {
    mockAuthenticatedUser();

    // .update().eq('id',...).eq('status',...) → 두 번째 eq가 터미널
    // 기본 mockReturnThis로 await mockChain → error: undefined → 성공
    const result = await abandonExamSession('session-1');

    expect(result.error).toBeNull();
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'abandoned' })
    );
  });

  it('returns classified error on update failure', async () => {
    mockAuthenticatedUser();

    // .update().eq().eq() → 두 번째 eq가 터미널
    mockDoubleEqTerminal({
      data: null,
      error: { code: 'PGRST000', message: 'Update failed' },
    });

    const result = await abandonExamSession('session-1');

    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// saveExamResponse
// ============================================================================

describe('saveExamResponse', () => {
  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await saveExamResponse({
      examSessionId: 'session-1',
      questionOrder: 1,
      audioUrl: 'path/to/audio.m4a',
      durationSec: 45,
    });

    expect(result.error).toBeInstanceOf(AppError);
  });

  it('updates response with audio URL on success', async () => {
    mockAuthenticatedUser();

    // .update().eq().eq() → 기본 mockReturnThis → 성공
    const result = await saveExamResponse({
      examSessionId: 'session-1',
      questionOrder: 1,
      audioUrl: 'path/to/audio.m4a',
      durationSec: 45,
    });

    expect(result.error).toBeNull();
    expect(chain.update).toHaveBeenCalledWith({
      audio_url: 'path/to/audio.m4a',
      duration_sec: 45,
    });
  });

  it('returns classified error on update failure', async () => {
    mockAuthenticatedUser();

    mockDoubleEqTerminal({
      data: null,
      error: { code: 'PGRST000', message: 'Update failed' },
    });

    const result = await saveExamResponse({
      examSessionId: 'session-1',
      questionOrder: 1,
      audioUrl: 'path/to/audio.m4a',
      durationSec: 45,
    });

    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// processExamResults
// ============================================================================

describe('processExamResults', () => {
  const recordings = [
    { questionOrder: 1, uri: 'file:///audio1.m4a', duration: 30 },
    { questionOrder: 2, uri: 'file:///audio2.m4a', duration: 45 },
  ];

  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await processExamResults('session-1', recordings);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('returns EXAM_NO_RECORDINGS for empty recordings', async () => {
    mockAuthenticatedUser();

    const result = await processExamResults('session-1', []);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('EXAM_NO_RECORDINGS');
  });

  it('returns EXAM_SESSION_NOT_FOUND when session does not exist', async () => {
    mockAuthenticatedUser();

    chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const result = await processExamResults('non-existent', recordings);

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('EXAM_SESSION_NOT_FOUND');
  });

  it('returns EXAM_ALREADY_COMPLETED when session is not in_progress', async () => {
    mockAuthenticatedUser();

    chain.single.mockResolvedValueOnce({
      data: { status: 'completed', processing_status: 'pending' },
      error: null,
    });

    const result = await processExamResults('session-1', recordings);

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('EXAM_ALREADY_COMPLETED');
  });

  it('returns EXAM_ALREADY_PROCESSING when processing_status is not pending', async () => {
    mockAuthenticatedUser();

    chain.single.mockResolvedValueOnce({
      data: { status: 'in_progress', processing_status: 'processing' },
      error: null,
    });

    const result = await processExamResults('session-1', recordings);

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('EXAM_ALREADY_PROCESSING');
  });

  it('returns EXAM_PROCESSING_FAILED when all uploads fail', async () => {
    mockAuthenticatedUser();

    chain.single.mockResolvedValueOnce({
      data: { status: 'in_progress', processing_status: 'pending' },
      error: null,
    });

    mockUploadRecording.mockResolvedValue({ data: null, error: new Error('Upload failed') });

    const result = await processExamResults('session-1', recordings);

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('EXAM_PROCESSING_FAILED');
    expect(result.partialSttFailures).toBe(2);
  });

  it('completes full pipeline: upload → STT → evaluate', async () => {
    mockAuthenticatedUser();

    // 세션 상태 확인
    chain.single.mockResolvedValueOnce({
      data: { status: 'in_progress', processing_status: 'pending' },
      error: null,
    });

    // 업로드 성공 (2회)
    mockUploadRecording
      .mockResolvedValueOnce({ data: { path: 'student-1/exam_s1_q1.m4a' }, error: null })
      .mockResolvedValueOnce({ data: { path: 'student-1/exam_s1_q2.m4a' }, error: null });

    // STT 성공 (2회)
    mockTranscribeAudio
      .mockResolvedValueOnce({ data: { transcription: 'Hello world' }, error: null })
      .mockResolvedValueOnce({ data: { transcription: 'My daily routine' }, error: null });

    // Claude 평가 성공
    mockInvokeFunction.mockResolvedValueOnce({
      data: { estimated_grade: 'IH', overall_score: 75 },
      error: null,
    });

    const onProgress = jest.fn();
    const result = await processExamResults('session-1', recordings, onProgress);

    expect(result.data).toEqual({ estimated_grade: 'IH', overall_score: 75 });
    expect(result.error).toBeNull();
    expect(result.partialSttFailures).toBeUndefined();

    // 진행률 콜백 검증
    expect(onProgress).toHaveBeenCalledWith('upload', 1, 2);
    expect(onProgress).toHaveBeenCalledWith('upload', 2, 2);
    expect(onProgress).toHaveBeenCalledWith('stt', 1, 2);
    expect(onProgress).toHaveBeenCalledWith('stt', 2, 2);
    expect(onProgress).toHaveBeenCalledWith('evaluate', 1, 1);

    // Edge Function 호출 검증
    expect(mockInvokeFunction).toHaveBeenCalledWith('claude-exam-evaluate', { examSessionId: 'session-1' });
  });

  it('returns classified error when Claude evaluation fails', async () => {
    mockAuthenticatedUser();

    chain.single.mockResolvedValueOnce({
      data: { status: 'in_progress', processing_status: 'pending' },
      error: null,
    });

    mockUploadRecording.mockResolvedValue({ data: { path: 'student-1/audio.m4a' }, error: null });
    mockTranscribeAudio.mockResolvedValue({ data: { transcription: 'text' }, error: null });

    mockInvokeFunction.mockResolvedValueOnce({
      data: null,
      error: { message: 'Rate limit exceeded' },
    });

    const result = await processExamResults('session-1', recordings);

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('tracks partial STT failures and still evaluates', async () => {
    mockAuthenticatedUser();

    chain.single.mockResolvedValueOnce({
      data: { status: 'in_progress', processing_status: 'pending' },
      error: null,
    });

    // 첫 번째 업로드 성공, 두 번째 실패
    mockUploadRecording
      .mockResolvedValueOnce({ data: { path: 'student-1/audio1.m4a' }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('Upload failed') });

    // STT 성공 (1회만 — 두 번째는 업로드 실패로 스킵)
    mockTranscribeAudio.mockResolvedValueOnce({ data: { transcription: 'Hello' }, error: null });

    mockInvokeFunction.mockResolvedValueOnce({
      data: { estimated_grade: 'IM', overall_score: 60 },
      error: null,
    });

    const result = await processExamResults('session-1', recordings);

    expect(result.data).toEqual({ estimated_grade: 'IM', overall_score: 60 });
    expect(result.partialSttFailures).toBe(1);
  });
});

// ============================================================================
// getRoleplayScenarios
// ============================================================================

describe('getRoleplayScenarios', () => {
  it('returns scenario list on success', async () => {
    const scenarios = [
      { id: 'rs1', title: '호텔 체크인', is_active: true, sort_order: 1 },
      { id: 'rs2', title: '식당 예약', is_active: true, sort_order: 2 },
    ];

    chain.order.mockResolvedValueOnce({ data: scenarios, error: null });

    const result = await getRoleplayScenarios();

    expect(result.data).toEqual(scenarios);
    expect(result.error).toBeNull();
    expect(chain.eq).toHaveBeenCalledWith('is_active', true);
  });

  it('returns classified error on DB failure', async () => {
    chain.order.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'DB error' },
    });

    const result = await getRoleplayScenarios();

    expect(result.data).toEqual([]);
    expect(result.error).toBeDefined();
  });

  it('returns empty array when data is null', async () => {
    chain.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await getRoleplayScenarios();

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });
});

// ============================================================================
// getRoleplayScenarioDetail
// ============================================================================

describe('getRoleplayScenarioDetail', () => {
  it('returns scenario with questions on success', async () => {
    const scenario = { id: 'rs1', title: '호텔 체크인', description: '호텔에서...' };
    const questions = [
      { id: 'rq1', position: 1, question_text: 'Check in please' },
      { id: 'rq2', position: 2, question_text: 'Room upgrade' },
    ];

    // Promise.all: scenario → single, questions → order
    chain.single.mockResolvedValueOnce({ data: scenario, error: null });
    chain.order.mockResolvedValueOnce({ data: questions, error: null });

    const result = await getRoleplayScenarioDetail('rs1');

    expect(result.data).toEqual({ scenario, questions });
    expect(result.error).toBeNull();
  });

  it('returns classified error on scenario query failure', async () => {
    chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });
    chain.order.mockResolvedValueOnce({ data: [], error: null });

    const result = await getRoleplayScenarioDetail('non-existent');

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// generateMockExamQuestions
// ============================================================================

describe('generateMockExamQuestions', () => {
  it('returns generated questions on success', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, questions: sampleQuestions, total_count: 2 },
      error: null,
    });

    const result = await generateMockExamQuestions(4, ['topic-1', 'topic-2']);

    expect(result.data).toEqual({ questions: sampleQuestions, totalCount: 2 });
    expect(result.error).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_mock_exam_questions', {
      p_self_assessment: 4,
      p_survey_topic_ids: ['topic-1', 'topic-2'],
    });
  });

  it('returns classified error on RPC failure', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'RPC error' },
    });

    const result = await generateMockExamQuestions(4, ['topic-1']);

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns classified RPC error on business logic failure', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'INSUFFICIENT_TOPICS' },
      error: null,
    });

    const result = await generateMockExamQuestions(4, []);

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns EXAM_PROCESSING_FAILED when RPC fails without error string', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false },
      error: null,
    });

    const result = await generateMockExamQuestions(4, []);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('EXAM_PROCESSING_FAILED');
  });
});

// ============================================================================
// generateLevelTestQuestions
// ============================================================================

describe('generateLevelTestQuestions', () => {
  it('returns generated questions on success', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, questions: sampleQuestions, total_count: 15 },
      error: null,
    });

    const result = await generateLevelTestQuestions();

    expect(result.data).toEqual({ questions: sampleQuestions, totalCount: 15 });
    expect(result.error).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_level_test_questions');
  });

  it('returns classified error on RPC failure', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'RPC error' },
    });

    const result = await generateLevelTestQuestions();

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('returns classified RPC error on business logic failure', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'EXAM_LIMIT_EXCEEDED' },
      error: null,
    });

    const result = await generateLevelTestQuestions();

    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// checkExamAvailability
// ============================================================================

describe('checkExamAvailability', () => {
  it('returns availability info on success', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, exams_remaining: 3, whisper_remaining: 25 },
      error: null,
    });

    const result = await checkExamAvailability('mock_test', 15);

    expect(result.success).toBe(true);
    expect(result.exams_remaining).toBe(3);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('check_exam_availability', {
      p_exam_type: 'mock_test',
      p_question_count: 15,
    });
  });

  it('defaults questionCount to 15', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await checkExamAvailability('level_test');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('check_exam_availability', {
      p_exam_type: 'level_test',
      p_question_count: 15,
    });
  });

  it('returns failure with classified error message on RPC failure', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'DB error' },
    });

    const result = await checkExamAvailability('mock_test');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('classifies RPC business error message', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'WHISPER_RATE_LIMIT' },
      error: null,
    });

    const result = await checkExamAvailability('mock_test');

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

// ============================================================================
// getSurveyTopics
// ============================================================================

describe('getSurveyTopics', () => {
  it('returns survey topics with group info on success', async () => {
    const topics = [
      { id: 't1', name_ko: '영화', category: 'survey', topic_groups: { id: 'g1', name_ko: '여가' } },
      { id: 't2', name_ko: '음악', category: 'survey', topic_groups: { id: 'g1', name_ko: '여가' } },
    ];

    // .select().eq().eq().order() → order 터미널
    chain.order.mockResolvedValueOnce({ data: topics, error: null });

    const result = await getSurveyTopics();

    expect(result.data).toEqual(topics);
    expect(result.error).toBeNull();
  });

  it('returns classified error on DB failure', async () => {
    chain.order.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'DB error' },
    });

    const result = await getSurveyTopics();

    expect(result.data).toEqual([]);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// getTopicsWithStrategy
// ============================================================================

describe('getTopicsWithStrategy', () => {
  it('returns topics with strategy metadata on success', async () => {
    const topics = [
      { id: 't1', name_ko: '영화', strategy_group: 'easy', difficulty_hint: 2, strategy_tip_ko: '쉬운 토픽' },
    ];

    // .select().eq().eq().order().order() → 두 번째 order가 터미널
    chain.order
      .mockReturnValueOnce(chain) // 첫 번째 order: 체인 계속
      .mockResolvedValueOnce({ data: topics, error: null }); // 두 번째 order: 터미널

    const result = await getTopicsWithStrategy();

    expect(result.data).toEqual(topics);
    expect(result.error).toBeNull();
  });

  it('returns classified error on DB failure', async () => {
    chain.order
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST000', message: 'DB error' },
      });

    const result = await getTopicsWithStrategy();

    expect(result.data).toEqual([]);
    expect(result.error).toBeDefined();
  });
});
