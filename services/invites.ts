import { supabase } from '@/lib/supabase';
import type { Invite, OrgRole } from '@/lib/types';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';

// ============================================================================
// Types
// ============================================================================

interface CreateInviteResult {
  success: boolean;
  invite_id?: string;
  code?: string;
  target_role?: OrgRole;
  expires_at?: string;
  error?: string;
}

interface UseInviteResult {
  success: boolean;
  teacher_id?: string;
  organization_id?: string;
  role?: OrgRole;
  notification_log_id?: string;
  error?: string;
}

// ============================================================================
// 강사용 함수
// ============================================================================

/**
 * 초대 코드 생성 (강사/원장용)
 * DB 함수 create_invite를 호출하여 새로운 초대 코드를 생성합니다.
 * @param targetRole - 초대 대상 역할 ('student' 또는 'teacher'). teacher 초대는 owner만 가능.
 */
export async function createInvite(
  expiresInDays: number = 7,
  targetRole: OrgRole = 'student'
): Promise<CreateInviteResult> {
  const { data, error } = await supabase.rpc('create_invite', {
    p_expires_in_days: expiresInDays,
    p_target_role: targetRole,
  });

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'invite' }).userMessage };
  }

  const result = data as unknown as CreateInviteResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'invite' }).userMessage;
  }
  return result;
}

/**
 * 내가 생성한 초대 코드 목록 조회 (강사용)
 */
export async function getMyInvites(): Promise<{ data: Invite[] | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'invite' }) };
  }

  return { data, error: null };
}

/**
 * 활성 초대 코드 조회 (강사용)
 * 아직 사용되지 않고 만료되지 않은 초대 코드
 */
export async function getActiveInvite(): Promise<{ data: Invite | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('teacher_id', user.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned (which is fine)
    return { data: null, error: classifyError(error, { resource: 'invite' }) };
  }

  return { data: data || null, error: null };
}

/**
 * 초대 코드 삭제 (강사용)
 * soft_delete_invite RPC: 서버가 소유권 검증 + Soft Delete
 */
export async function deleteInvite(inviteId: string): Promise<{ error: Error | null }> {
  const { data, error } = await (supabase.rpc as CallableFunction)('soft_delete_invite', {
    p_invite_id: inviteId,
  });

  if (error) {
    return { error: classifyError(error, { resource: 'invite' }) };
  }

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    return { error: result.error ? classifyRpcError(result.error, { resource: 'invite' }) : new AppError('SVR_UNKNOWN') };
  }

  return { error: null };
}

// ============================================================================
// 학생용 함수
// ============================================================================

/**
 * 초대 코드 사용 (학생용)
 * DB 함수 use_invite_code를 호출하여 강사와 연결합니다.
 */
export async function useInviteCode(code: string): Promise<UseInviteResult> {
  const { data, error } = await supabase.rpc('use_invite_code', {
    p_code: code.toUpperCase().trim(),
  });

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'invite' }).userMessage };
  }

  const result = data as unknown as UseInviteResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'invite' }).userMessage;
  }
  return result;
}

/**
 * 초대 코드 유효성 확인 (학생용)
 * 실제로 사용하지 않고 유효한지만 확인
 */
export async function validateInviteCode(code: string): Promise<{ valid: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('invites')
    .select('id, expires_at')
    .eq('code', code.toUpperCase().trim())
    .eq('status', 'pending')
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return { valid: false, error: 'INVALID_CODE' };
  }

  return { valid: true };
}
