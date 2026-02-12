import { mockSupabase } from '../mocks/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
}));

import { getMyTeacher, isConnectedToTeacher } from '@/services/connection';
import { AppError } from '@/lib/errors';

beforeEach(() => jest.clearAllMocks());

// ============================================================================
// getMyTeacher
// ============================================================================

describe('getMyTeacher', () => {
  it('미인증 사용자 -> AUTH_REQUIRED 에러 반환', async () => {
    // getUser returns null user (default mock behavior)
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await getMyTeacher();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('연결된 강사가 있을 때 -> teacher 객체 반환', async () => {
    const mockUser = { id: 'student-1', email: 'student@test.com' };
    const mockTeacher = {
      id: 'teacher-1',
      name: 'Jin',
      email: 'jin@test.com',
    };
    const mockConnection = {
      created_at: '2026-01-15T10:00:00Z',
      teacher: mockTeacher,
    };

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: mockConnection,
      error: null,
    });

    const result = await getMyTeacher();

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      id: 'teacher-1',
      name: 'Jin',
      email: 'jin@test.com',
      connected_at: '2026-01-15T10:00:00Z',
    });

    // Verify correct table and filters were used
    expect(mockSupabase.from).toHaveBeenCalledWith('teacher_student');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('student_id', 'student-1');
    expect(mockSupabase._mockChain.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('연결된 강사 없음 (PGRST116) -> data: null, error: null 반환', async () => {
    const mockUser = { id: 'student-2', email: 'lonely@test.com' };

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows returned' },
    });

    const result = await getMyTeacher();

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it('DB 에러 -> classifyError로 분류된 에러 반환', async () => {
    const mockUser = { id: 'student-3', email: 'error@test.com' };
    const dbError = { code: '42501', message: 'permission denied for table teacher_student' };

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: dbError,
    });

    const result = await getMyTeacher();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    // 42501 maps to PERM_UNAUTHORIZED via classifyError
    expect((result.error as AppError).code).toBe('PERM_UNAUTHORIZED');
  });

  it('connection.teacher가 null인 경우 -> data: null, error: null 반환', async () => {
    const mockUser = { id: 'student-4', email: 'nullteacher@test.com' };

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: { created_at: '2026-01-15T10:00:00Z', teacher: null },
      error: null,
    });

    const result = await getMyTeacher();

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});

// ============================================================================
// isConnectedToTeacher
// ============================================================================

describe('isConnectedToTeacher', () => {
  it('강사에 연결되어 있을 때 -> true 반환', async () => {
    const mockUser = { id: 'student-1', email: 'student@test.com' };
    const mockConnection = {
      created_at: '2026-01-15T10:00:00Z',
      teacher: { id: 'teacher-1', name: 'Jin', email: 'jin@test.com' },
    };

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: mockConnection,
      error: null,
    });

    const result = await isConnectedToTeacher();

    expect(result).toBe(true);
  });

  it('강사에 연결되어 있지 않을 때 -> false 반환', async () => {
    const mockUser = { id: 'student-2', email: 'lonely@test.com' };

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows returned' },
    });

    const result = await isConnectedToTeacher();

    expect(result).toBe(false);
  });

  it('에러 발생 시 -> false 반환 (에러 무시 패턴)', async () => {
    // getUser returns null user -> getMyTeacher returns { data: null, error: AppError }
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await isConnectedToTeacher();

    // Even though getMyTeacher returns an error, isConnectedToTeacher only checks data !== null
    expect(result).toBe(false);
  });
});
