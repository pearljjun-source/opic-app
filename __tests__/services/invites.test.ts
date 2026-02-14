import { mockSupabase } from '../mocks/supabase';
import { AppError, ERROR_MESSAGES } from '@/lib/errors';

// jest.mock 호이스팅 문제 해결: require()는 런타임에 실행되므로 안전
jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
}));

// Import AFTER mocking
import {
  createInvite,
  useInviteCode,
  getActiveInvite,
  getMyInvites,
  deleteInvite,
  validateInviteCode,
} from '@/services/invites';

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// createInvite()
// ============================================================================
describe('createInvite()', () => {
  it('RPC success returns success: true with invite_id, code, expires_at', async () => {
    const mockData = {
      success: true,
      invite_id: 'inv-1',
      code: 'ABC123',
      expires_at: '2026-02-13T00:00:00Z',
    };
    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await createInvite(7);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_invite', { p_expires_in_days: 7, p_target_role: 'student' });
    expect(result.success).toBe(true);
    expect(result.invite_id).toBe('inv-1');
    expect(result.code).toBe('ABC123');
    expect(result.expires_at).toBe('2026-02-13T00:00:00Z');
  });

  it('defaults expiresInDays to 7', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, invite_id: 'inv-2' },
      error: null,
    });

    await createInvite();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_invite', { p_expires_in_days: 7, p_target_role: 'student' });
  });

  it('RPC Supabase error returns success: false with Korean error message', async () => {
    const supabaseError = { code: '42501', message: 'Permission denied' };
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: supabaseError });

    const result = await createInvite();

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    // classifyError for 42501 yields PERM_UNAUTHORIZED
    expect(result.error).toBe(ERROR_MESSAGES.PERM_UNAUTHORIZED);
  });

  it('RPC success with business error UNAUTHORIZED returns Korean message', async () => {
    const mockData = {
      success: false,
      error: 'UNAUTHORIZED',
    };
    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await createInvite();

    expect(result.success).toBe(false);
    // classifyRpcError('UNAUTHORIZED') -> PERM_UNAUTHORIZED
    expect(result.error).toBe(ERROR_MESSAGES.PERM_UNAUTHORIZED);
  });

  it('RPC success with business error NOT_TEACHER returns Korean message', async () => {
    const mockData = {
      success: false,
      error: 'NOT_TEACHER',
    };
    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await createInvite();

    expect(result.success).toBe(false);
    expect(result.error).toBe(ERROR_MESSAGES.PERM_NOT_TEACHER);
  });
});

// ============================================================================
// useInviteCode()
// ============================================================================
describe('useInviteCode()', () => {
  it('RPC success returns success: true with teacher_id', async () => {
    const mockData = {
      success: true,
      teacher_id: 'teacher-1',
      notification_log_id: 'notif-1',
    };
    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await useInviteCode('ABC123');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('use_invite_code', { p_code: 'ABC123' });
    expect(result.success).toBe(true);
    expect(result.teacher_id).toBe('teacher-1');
    expect(result.notification_log_id).toBe('notif-1');
  });

  it('RPC Supabase error returns success: false with Korean error', async () => {
    const supabaseError = { code: 'PGRST116', message: 'Row not found' };
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: supabaseError });

    const result = await useInviteCode('BADCODE');

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    // classifyError with resource 'invite' and PGRST116 -> NF_INVITE
    // But the service calls classifyError(error, { resource: 'invite' })
    // Actually the service doesn't pass resource context for this error path:
    // it uses classifyError(error, { resource: 'invite' }).userMessage
    expect(result.error).toBeTruthy();
  });

  it('RPC success with business error INVALID_CODE returns Korean message', async () => {
    const mockData = {
      success: false,
      error: 'INVALID_CODE',
    };
    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await useInviteCode('WRONG1');

    expect(result.success).toBe(false);
    // classifyRpcError('INVALID_CODE') -> VAL_INVITE_CODE_INVALID
    expect(result.error).toBe(ERROR_MESSAGES.VAL_INVITE_CODE_INVALID);
  });

  it('RPC success with business error CODE_ALREADY_USED returns Korean message', async () => {
    const mockData = {
      success: false,
      error: 'CODE_ALREADY_USED',
    };
    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await useInviteCode('USED01');

    expect(result.success).toBe(false);
    // classifyRpcError('CODE_ALREADY_USED') -> CONFLICT_CODE_USED
    expect(result.error).toBe(ERROR_MESSAGES.CONFLICT_CODE_USED);
  });

  it('normalizes code: lowercase + whitespace -> toUpperCase().trim()', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, teacher_id: 'teacher-1' },
      error: null,
    });

    await useInviteCode('  abc123  ');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('use_invite_code', { p_code: 'ABC123' });
  });

  it('RPC success with business error ALREADY_CONNECTED returns Korean message', async () => {
    const mockData = {
      success: false,
      error: 'ALREADY_CONNECTED',
    };
    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await useInviteCode('CODE01');

    expect(result.success).toBe(false);
    expect(result.error).toBe(ERROR_MESSAGES.CONFLICT_ALREADY_CONNECTED);
  });
});

// ============================================================================
// getActiveInvite()
// ============================================================================
describe('getActiveInvite()', () => {
  it('returns data when an active invite exists', async () => {
    const mockInvite = {
      id: 'inv-1',
      code: 'ABC123',
      status: 'pending',
      teacher_id: 'user-1',
      expires_at: '2026-02-15T00:00:00Z',
      created_at: '2026-02-08T00:00:00Z',
    };

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: mockInvite,
      error: null,
    });

    const result = await getActiveInvite();

    expect(result.data).toEqual(mockInvite);
    expect(result.error).toBeNull();
    expect(mockSupabase.from).toHaveBeenCalledWith('invites');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('teacher_id', 'user-1');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('returns data: null, error: null when no active invite (PGRST116)', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    });

    const result = await getActiveInvite();

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns error for non-PGRST116 DB error', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Permission denied' },
    });

    const result = await getActiveInvite();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('PERM_UNAUTHORIZED');
  });

  it('returns AUTH_REQUIRED error when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
    });

    const result = await getActiveInvite();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });
});

// ============================================================================
// getMyInvites()
// ============================================================================
describe('getMyInvites()', () => {
  it('returns list of invites on success', async () => {
    const mockInvites = [
      { id: 'inv-1', code: 'ABC123', status: 'pending', teacher_id: 'user-1' },
      { id: 'inv-2', code: 'DEF456', status: 'used', teacher_id: 'user-1' },
    ];

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });

    // getMyInvites calls .from().select().eq().order() which returns the chain.
    // The chain ends with .order() which returns mockReturnThis(), so the resolved value
    // is the chain itself. But the chain methods all return `this`, so the last call
    // in the chain is `.order(...)` which returns the chain (mockReturnThis).
    // Since there is no .single(), the result of the chain is the resolved value of .order().
    // We need to make .order() resolve with our data.
    mockSupabase._mockChain.order.mockResolvedValueOnce({
      data: mockInvites,
      error: null,
    });

    const result = await getMyInvites();

    expect(result.data).toEqual(mockInvites);
    expect(result.error).toBeNull();
    expect(mockSupabase.from).toHaveBeenCalledWith('invites');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('teacher_id', 'user-1');
    expect(mockSupabase._mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns AUTH_REQUIRED error when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
    });

    const result = await getMyInvites();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('AUTH_REQUIRED');
  });

  it('returns classified error on DB failure', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase._mockChain.order.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Permission denied' },
    });

    const result = await getMyInvites();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AppError);
  });
});

// ============================================================================
// deleteInvite()
// ============================================================================
describe('deleteInvite()', () => {
  it('RPC success returns error: null', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const result = await deleteInvite('inv-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('soft_delete_invite', { p_invite_id: 'inv-1' });
    expect(result.error).toBeNull();
  });

  it('RPC Supabase error returns classified error', async () => {
    const supabaseError = { code: '42501', message: 'Permission denied' };
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: supabaseError });

    const result = await deleteInvite('inv-1');

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('PERM_UNAUTHORIZED');
  });

  it('RPC success with business error UNAUTHORIZED returns classified error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'UNAUTHORIZED' },
      error: null,
    });

    const result = await deleteInvite('inv-1');

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('PERM_UNAUTHORIZED');
  });

  it('RPC success with business error (no error string) returns SVR_UNKNOWN', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false },
      error: null,
    });

    const result = await deleteInvite('inv-1');

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('SVR_UNKNOWN');
  });

  it('RPC success with business error NOT_TEACHER returns classified error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'NOT_TEACHER' },
      error: null,
    });

    const result = await deleteInvite('inv-1');

    expect(result.error).toBeInstanceOf(AppError);
    expect((result.error as AppError).code).toBe('PERM_NOT_TEACHER');
  });
});

// ============================================================================
// validateInviteCode()
// ============================================================================
describe('validateInviteCode()', () => {
  it('returns valid: true when code exists and is active', async () => {
    const mockData = {
      id: 'inv-1',
      expires_at: '2026-02-15T00:00:00Z',
    };

    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: mockData,
      error: null,
    });

    const result = await validateInviteCode('ABC123');

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockSupabase.from).toHaveBeenCalledWith('invites');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('code', 'ABC123');
    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('returns valid: false with INVALID_CODE when code does not exist', async () => {
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    });

    const result = await validateInviteCode('BADCOD');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_CODE');
  });

  it('returns valid: false with INVALID_CODE on any DB error', async () => {
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Permission denied' },
    });

    const result = await validateInviteCode('ANYCODE');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_CODE');
  });

  it('normalizes code: lowercase + whitespace -> toUpperCase().trim()', async () => {
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: { id: 'inv-1', expires_at: '2026-02-15T00:00:00Z' },
      error: null,
    });

    await validateInviteCode('  abc123  ');

    expect(mockSupabase._mockChain.eq).toHaveBeenCalledWith('code', 'ABC123');
  });

  it('returns valid: false when data is null but no error', async () => {
    mockSupabase._mockChain.single.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await validateInviteCode('NODATA');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_CODE');
  });
});
