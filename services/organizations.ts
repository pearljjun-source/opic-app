import { supabase } from '@/lib/supabase';
import type { MyOrganization, OrgTeacherItem, OrgRole } from '@/lib/types';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';

// ============================================================================
// Types
// ============================================================================

interface OrgMutationResult {
  success: boolean;
  organization_id?: string;
  error?: string;
}

interface MemberMutationResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// 조직 조회
// ============================================================================

/** 내가 속한 조직 목록 조회 */
export async function getMyOrganizations(): Promise<{
  data: MyOrganization[] | null;
  error: Error | null;
}> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_my_organizations'
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'organization' }) };
  }

  return { data: (data as MyOrganization[]) || [], error: null };
}

// ============================================================================
// 조직 생성
// ============================================================================

/** 새 학원/조직 생성 (owner로 자동 등록) */
export async function createOrganization(name: string): Promise<OrgMutationResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'create_organization',
    { p_name: name }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'organization' }).userMessage };
  }

  const result = data as OrgMutationResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'organization' }).userMessage;
  }
  return result;
}

// ============================================================================
// 조직 수정
// ============================================================================

/** 학원명 수정 (owner 전용 — SECURITY DEFINER RPC) */
export async function updateOrganization(
  orgId: string,
  name: string
): Promise<MemberMutationResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'update_organization_name',
    { p_org_id: orgId, p_name: name }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'organization' }).userMessage };
  }

  const result = data as MemberMutationResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'organization' }).userMessage;
  }
  return result;
}

// ============================================================================
// 강사 관리 (owner 전용)
// ============================================================================

/** 조직 내 강사/원장 목록 조회 */
export async function getOrgTeachers(orgId: string): Promise<{
  data: OrgTeacherItem[] | null;
  error: Error | null;
}> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_org_teachers',
    { p_org_id: orgId }
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'organization' }) };
  }

  const result = data as OrgTeacherItem[] | { error?: string };
  if (result && !Array.isArray(result) && (result as { error?: string }).error) {
    return {
      data: null,
      error: classifyRpcError((result as { error: string }).error, { resource: 'organization' }),
    };
  }

  return { data: (result as OrgTeacherItem[]) || [], error: null };
}

// ============================================================================
// 멤버 관리 (owner 전용)
// ============================================================================

/** 조직에서 멤버 제거 */
export async function removeOrgMember(
  orgId: string,
  userId: string
): Promise<MemberMutationResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'remove_org_member',
    { p_org_id: orgId, p_user_id: userId }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'organization' }).userMessage };
  }

  const result = data as MemberMutationResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'organization' }).userMessage;
  }
  return result;
}

/** 멤버 역할 변경 (owner 전용) */
export async function changeMemberRole(
  orgId: string,
  userId: string,
  role: OrgRole
): Promise<MemberMutationResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'change_member_role',
    { p_org_id: orgId, p_user_id: userId, p_role: role }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'organization' }).userMessage };
  }

  const result = data as MemberMutationResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'organization' }).userMessage;
  }
  return result;
}
