import { supabase } from '@/lib/supabase';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';
import { safeParse } from 'valibot';
import {
  RoleChangeSchema,
  OwnerInviteCreateSchema,
  OwnerInviteDeleteSchema,
  OrgUpdateSchema,
  OrgDeleteSchema,
  AdminSubUpdateSchema,
} from '@/lib/validations';
import type {
  AdminDashboardStats,
  AdminUserListItem,
  AdminAuditLog,
  AdminOwnerInviteItem,
  AdminOrganizationItem,
  AdminOrgMemberItem,
  AdminOrgSubscription,
  EffectiveRole,
  PaymentRecord,
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
  role?: EffectiveRole;
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

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'user' }) };
  }

  return { data: (data?.users as AdminUserListItem[]) || [], error: null };
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

// ============================================================================
// 학원 관리 (Super Admin)
// ============================================================================

/** 학원 원장 초대 코드 생성 */
export async function createOwnerInvite(params: {
  orgName: string;
  expiresInDays?: number;
}): Promise<{
  data: { invite_id: string; code: string; organization_name: string; expires_at: string } | null;
  error: Error | null;
}> {
  // Valibot 검증
  const validation = safeParse(OwnerInviteCreateSchema, {
    orgName: params.orgName,
    expiresInDays: params.expiresInDays,
  });
  if (!validation.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_create_owner_invite',
    {
      p_org_name: params.orgName,
      p_expires_in_days: params.expiresInDays || 30,
    }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'invite' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'invite' }) };
  }

  return { data, error: null };
}

/** 학원 원장 초대 목록 조회 */
export async function listOwnerInvites(): Promise<{
  data: AdminOwnerInviteItem[] | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_list_owner_invites'
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'invite' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'invite' }) };
  }

  return { data: data?.invites || [], error: null };
}

/** 학원 원장 초대 삭제 */
export async function deleteOwnerInvite(inviteId: string): Promise<{
  data: { success: boolean } | null;
  error: Error | null;
}> {
  // Valibot 검증
  const validation = safeParse(OwnerInviteDeleteSchema, { inviteId });
  if (!validation.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_delete_owner_invite',
    { p_invite_id: inviteId }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'invite' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'invite' }) };
  }

  return { data: { success: true }, error: null };
}

/** 전체 학원 목록 조회 */
export async function listOrganizations(): Promise<{
  data: AdminOrganizationItem[] | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_list_organizations'
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'organization' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'organization' }) };
  }

  return { data: data?.organizations || [], error: null };
}

// ============================================================================
// 학원 상세 (Super Admin)
// ============================================================================

/** 학원 상세 조회 (org 정보 + 멤버 + 구독) */
export async function getOrganizationDetail(orgId: string): Promise<{
  data: {
    members: AdminOrgMemberItem[];
    subscription: AdminOrgSubscription | null;
  } | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_get_organization_detail',
    { p_org_id: orgId }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'organization' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'organization' }) };
  }

  const members: AdminOrgMemberItem[] = (data?.members || []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    name: m.name || '(알 수 없음)',
    email: m.email || '',
    role: m.role,
    created_at: m.created_at,
  }));

  let subscription: AdminOrgSubscription | null = null;
  if (data?.subscription) {
    const sub = data.subscription;
    subscription = {
      id: sub.id,
      status: sub.status,
      plan_name: sub.plan_name || '(알 수 없음)',
      plan_key: sub.plan_key || '',
      plan_id: sub.plan_id,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end || false,
      canceled_at: sub.canceled_at || null,
    };
  }

  return { data: { members, subscription }, error: null };
}

/** 학원 이름 수정 */
export async function updateOrganization(
  orgId: string,
  updates: { name: string }
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  const validation = safeParse(OrgUpdateSchema, { orgId, name: updates.name });
  if (!validation.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_update_organization',
    { p_org_id: orgId, p_updates: { name: updates.name } }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'organization' }) };
  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'organization' }) };
  }

  return { data: { success: true }, error: null };
}

/** 학원 삭제 (cascade soft-delete) */
export async function deleteOrganization(
  orgId: string,
  reason?: string
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  const validation = safeParse(OrgDeleteSchema, { orgId });
  if (!validation.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_delete_organization',
    { p_org_id: orgId, p_reason: reason || null }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'organization' }) };
  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'organization' }) };
  }

  return { data: { success: true }, error: null };
}

/** 학원 구독 플랜 변경/생성 */
export async function adminUpdateSubscription(
  orgId: string,
  planKey: string
): Promise<{ data: { success: boolean; action?: string } | null; error: Error | null }> {
  const validation = safeParse(AdminSubUpdateSchema, { orgId, planKey });
  if (!validation.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_update_subscription',
    { p_org_id: orgId, p_plan_key: planKey }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'subscription' }) };
  }

  return { data: { success: true, action: data?.action }, error: null };
}

/** 학원 구독 취소 */
export async function adminCancelSubscription(
  orgId: string,
  immediate: boolean
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_cancel_subscription',
    { p_org_id: orgId, p_immediate: immediate }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'subscription' }) };
  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'subscription' }) };
  }

  return { data: { success: true }, error: null };
}

/** 학원 결제 이력 조회 */
export async function getOrganizationPayments(orgId: string): Promise<{
  data: PaymentRecord[] | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_get_org_payments',
    { p_org_id: orgId }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'subscription' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'subscription' }) };
  }

  return { data: (data?.payments as PaymentRecord[]) || [], error: null };
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
