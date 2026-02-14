import { supabase } from '@/lib/supabase';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';
import { safeParse } from 'valibot';
import { RoleChangeSchema } from '@/lib/validations';
import type {
  AdminDashboardStats,
  AdminUserListItem,
  AdminAuditLog,
  UserRole,
} from '@/lib/types';

// ============================================================================
// Admin 서비스 — 사용자 관리 + KPI
// ============================================================================

/** 대시보드 KPI 통계 조회 */
export async function getAdminDashboardStats(): Promise<{
  data: AdminDashboardStats | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_admin_dashboard_stats'
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'user' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'user' }) };
  }

  return { data: data as AdminDashboardStats, error: null };
}

/** 사용자 목록 조회 (페이지네이션) */
export async function listUsers(params: {
  role?: UserRole;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  data: AdminUserListItem[] | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_list_users',
    {
      p_role: params.role || null,
      p_search: params.search || null,
      p_limit: params.limit || 20,
      p_offset: params.offset || 0,
    }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'user' }) };

  // RPC가 JSON 배열을 반환
  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'user' }) };
  }

  return { data: (data as AdminUserListItem[]) || [], error: null };
}

/** 사용자 역할 변경 */
export async function changeUserRole(
  userId: string,
  newRole: 'teacher' | 'student'
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  // Valibot 검증
  const result = safeParse(RoleChangeSchema, { userId, newRole });
  if (!result.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_change_user_role',
    {
      p_user_id: userId,
      p_new_role: newRole,
    }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'user' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'user' }) };
  }

  return { data: { success: true }, error: null };
}

/** 감사 로그 조회 */
export async function getAuditLogs(params?: {
  resourceType?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  data: AdminAuditLog[] | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  let query = supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params?.limit || 50);

  if (params?.resourceType) {
    query = query.eq('resource_type', params.resourceType);
  }

  if (params?.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: classifyError(error, { resource: 'user' }) };

  return { data: (data as AdminAuditLog[]) || [], error: null };
}
