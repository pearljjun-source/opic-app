import { mockSupabase } from '../mocks/supabase';
import { AppError } from '@/lib/errors';

// ============================================================================
// Mock Setup — require()로 jest.mock 호이스팅 문제 해결
// ============================================================================

jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
}));

import {
  getTopics,
  getQuestionsByTopic,
  createScript,
  getScript,
  updateScript,
  deleteScript,
  getMyScripts,
  getStudentScript,
} from '@/services/scripts';

// ============================================================================
// Helpers
// ============================================================================

function mockAuthenticatedUser(userId = 'teacher-1') {
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

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// getTopics()
// ============================================================================

describe('getTopics', () => {
  it('returns topic list on success', async () => {
    const topics = [
      { id: 't1', name_ko: '자기소개', name_en: 'Self Introduction', icon: 'user', description: null },
      { id: 't2', name_ko: '여행', name_en: 'Travel', icon: 'plane', description: 'Travel topic' },
    ];

    mockSupabase._mockChain.order.mockResolvedValueOnce({
      data: topics,
      error: null,
    });

    const result = await getTopics();

    expect(result.data).toEqual(topics);
    expect(result.error).toBeNull();
    expect(mockSupabase.from).toHaveBeenCalledWith('topics');
    expect(mockSupabase._mockChain.select).toHaveBeenCalledWith(
      'id, name_ko, name_en, icon, description, category'
    );
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('is_active', true);
    expect(mockSupabase._mockChain.order).toHaveBeenCalledWith('sort_order', { ascending: true });
  });

  it('returns classified error on DB failure', async () => {
    mockSupabase._mockChain.order.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'DB error' },
    });

    const result = await getTopics();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
  });
});

// ============================================================================
// getQuestionsByTopic()
// ============================================================================

describe('getQuestionsByTopic', () => {
  const topicId = 'topic-123';

  it('returns question list on success', async () => {
    const questions = [
      {
        id: 'q1',
        question_text: 'Describe your house.',
        question_type: 'describe',
        difficulty: 3,
        hint_ko: '집을 묘사하세요',
        audio_url: null,
      },
    ];

    mockSupabase._mockChain.order.mockResolvedValueOnce({
      data: questions,
      error: null,
    });

    const result = await getQuestionsByTopic(topicId);

    expect(result.data).toEqual(questions);
    expect(result.error).toBeNull();
    expect(mockSupabase.from).toHaveBeenCalledWith('questions');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('topic_id', topicId);
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('is_active', true);
  });

  it('returns classified error on DB failure', async () => {
    mockSupabase._mockChain.order.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'DB error' },
    });

    const result = await getQuestionsByTopic(topicId);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
  });
});

// ============================================================================
// createScript()
// ============================================================================

describe('createScript', () => {
  const params = {
    studentId: 'student-1',
    questionId: 'question-1',
    content: 'My script content',
    comment: 'Good job',
  };

  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await createScript(params);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('returns PERM_NOT_CONNECTED when connection not found', async () => {
    mockAuthenticatedUser('teacher-1');

    // Connection query returns null (no connection found)
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await createScript(params);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('PERM_NOT_CONNECTED');
    expect(mockSupabase.from).toHaveBeenCalledWith('teacher_student');
  });

  it('returns script id on successful creation', async () => {
    mockAuthenticatedUser('teacher-1');

    // Connection exists
    mockSupabase._mockChain.single
      .mockResolvedValueOnce({
        data: { id: 'conn-1' },
        error: null,
      })
      // Insert returns new script id
      .mockResolvedValueOnce({
        data: { id: 'script-new-1' },
        error: null,
      });

    const result = await createScript(params);

    expect(result.data).toEqual({ id: 'script-new-1' });
    expect(result.error).toBeNull();
    expect(mockSupabase.from).toHaveBeenCalledWith('scripts');
    expect(mockSupabase._mockChain.insert).toHaveBeenCalledWith({
      student_id: params.studentId,
      teacher_id: 'teacher-1',
      question_id: params.questionId,
      content: params.content,
      comment: params.comment,
      status: 'complete',
    });
  });

  it('returns classified error when insert fails', async () => {
    mockAuthenticatedUser('teacher-1');

    // Connection exists
    mockSupabase._mockChain.single
      .mockResolvedValueOnce({
        data: { id: 'conn-1' },
        error: null,
      })
      // Insert fails
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

    const result = await createScript(params);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
  });
});

// ============================================================================
// getScript()
// ============================================================================

describe('getScript', () => {
  const scriptId = 'script-1';

  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await getScript(scriptId);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('returns ScriptDetail on success', async () => {
    mockAuthenticatedUser('teacher-1');

    const dbData = {
      id: 'script-1',
      content: 'My script',
      comment: 'Great work',
      status: 'complete',
      student_id: 'student-1',
      teacher_id: 'teacher-1',
      created_at: '2026-01-15T10:00:00Z',
      updated_at: null,
      question: {
        id: 'q-1',
        question_text: 'Describe your house.',
        question_type: 'describe',
        difficulty: 3,
        audio_url: null,
        topic: {
          id: 'topic-1',
          name_ko: '집',
          name_en: 'House',
          icon: 'home',
        },
      },
    };

    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: dbData,
      error: null,
    });

    const result = await getScript(scriptId);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      id: 'script-1',
      content: 'My script',
      comment: 'Great work',
      status: 'complete',
      student_id: 'student-1',
      teacher_id: 'teacher-1',
      question: dbData.question,
      created_at: '2026-01-15T10:00:00Z',
      updated_at: null,
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('scripts');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('id', scriptId);
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('teacher_id', 'teacher-1');
    expect(mockSupabase._mockChain.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('returns classified error when script not found', async () => {
    mockAuthenticatedUser('teacher-1');

    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows returned' },
    });

    const result = await getScript(scriptId);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('NF_SCRIPT');
  });
});

// ============================================================================
// updateScript()
// ============================================================================

describe('updateScript', () => {
  const params = {
    scriptId: 'script-1',
    content: 'Updated content',
    comment: 'Revised',
  };

  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await updateScript(params);

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('returns null error on success', async () => {
    mockAuthenticatedUser('teacher-1');

    // update().eq().eq().is() chain — the is() is the terminal method
    mockSupabase._mockChain.is.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await updateScript(params);

    expect(result.error).toBeNull();
    expect(mockSupabase.from).toHaveBeenCalledWith('scripts');
    expect(mockSupabase._mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Updated content',
        comment: 'Revised',
      })
    );
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('id', 'script-1');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('teacher_id', 'teacher-1');
    expect(mockSupabase._mockChain.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('returns classified error on DB failure', async () => {
    mockAuthenticatedUser('teacher-1');

    mockSupabase._mockChain.is.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    const result = await updateScript(params);

    expect(result.error).toBeInstanceOf(AppError);
  });
});

// ============================================================================
// deleteScript()
// ============================================================================

describe('deleteScript', () => {
  const scriptId = 'script-1';

  it('returns AUTH_REQUIRED when RPC returns auth error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'not authenticated' },
    });

    const result = await deleteScript(scriptId);

    expect(result.error).toBeInstanceOf(AppError);
  });

  it('returns null error on RPC success', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const result = await deleteScript(scriptId);

    expect(result.error).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('soft_delete_script', {
      p_script_id: scriptId,
    });
  });

  it('returns classified error on RPC failure', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'server error' },
    });

    const result = await deleteScript(scriptId);

    expect(result.error).toBeInstanceOf(AppError);
  });

  it('returns classifyRpcError result on business error (success: false)', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'UNAUTHORIZED' },
      error: null,
    });

    const result = await deleteScript(scriptId);

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('PERM_UNAUTHORIZED');
  });

  it('returns SVR_UNKNOWN when business error has no error string', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false },
      error: null,
    });

    const result = await deleteScript(scriptId);

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('SVR_UNKNOWN');
  });
});

// ============================================================================
// getMyScripts() (student)
// ============================================================================

describe('getMyScripts', () => {
  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await getMyScripts();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('returns transformed script list on success', async () => {
    mockAuthenticatedUser('student-1');

    const dbData = [
      {
        id: 's1',
        content: 'My answer',
        comment: 'Good',
        created_at: '2026-01-20T10:00:00Z',
        question: {
          question_text: 'Tell me about your house.',
          topic: {
            name_ko: '집',
            icon: 'home',
          },
        },
      },
    ];

    mockSupabase._mockChain.order.mockResolvedValueOnce({
      data: dbData,
      error: null,
    });

    const result = await getMyScripts();

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        id: 's1',
        content: 'My answer',
        comment: 'Good',
        question_text: 'Tell me about your house.',
        topic_name_ko: '집',
        topic_icon: 'home',
        created_at: '2026-01-20T10:00:00Z',
      },
    ]);
    expect(mockSupabase.from).toHaveBeenCalledWith('scripts');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('student_id', 'student-1');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('status', 'complete');
    expect(mockSupabase._mockChain.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('returns classified error on DB failure', async () => {
    mockAuthenticatedUser('student-1');

    mockSupabase._mockChain.order.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST000', message: 'DB error' },
    });

    const result = await getMyScripts();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
  });
});

// ============================================================================
// getStudentScript() (student)
// ============================================================================

describe('getStudentScript', () => {
  const scriptId = 'script-1';

  it('returns AUTH_REQUIRED when not authenticated', async () => {
    mockUnauthenticatedUser();

    const result = await getStudentScript(scriptId);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('returns StudentScriptDetail on success', async () => {
    mockAuthenticatedUser('student-1');

    const dbData = {
      id: 'script-1',
      content: 'My script content',
      comment: 'Nice work',
      question: {
        id: 'q-1',
        question_text: 'Describe your daily routine.',
        audio_url: 'https://storage.example.com/audio/q1.mp3',
      },
    };

    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: dbData,
      error: null,
    });

    const result = await getStudentScript(scriptId);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      id: 'script-1',
      content: 'My script content',
      comment: 'Nice work',
      question: {
        id: 'q-1',
        question_text: 'Describe your daily routine.',
        audio_url: 'https://storage.example.com/audio/q1.mp3',
      },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('scripts');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('id', scriptId);
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('student_id', 'student-1');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('status', 'complete');
    expect(mockSupabase._mockChain.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('returns classified error when script not found', async () => {
    mockAuthenticatedUser('student-1');

    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows returned' },
    });

    const result = await getStudentScript(scriptId);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('NF_SCRIPT');
  });
});
