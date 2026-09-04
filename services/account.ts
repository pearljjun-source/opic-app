import { supabase, invokeFunction } from '@/lib/supabase';
import { AppError, classifyError } from '@/lib/errors';

// ============================================================================
// 계정 관리
// ============================================================================

export interface AccountDeletionCheck {
  /** 지금 탈퇴할 수 있는지 */
  deletable: boolean;
  /** 막힌 이유 (deletable=false일 때) */
  reason: 'NOT_AUTHENTICATED' | 'SUBSCRIPTION_ACTIVE' | 'CHECK_FAILED' | null;
  /** 학원 대표 계정인지 — 경고 문구가 달라진다 */
  isOwner: boolean;
  orgName: string | null;
  /** 본인을 제외한 학원 구성원 수 */
  memberCount: number;
}

/**
 * 탈퇴 가능 여부 확인.
 *
 * 원장은 결제 주체이므로 활성 구독이 남아 있으면 막는다. 결제가 살아 있는 채로
 * 탈퇴하면 "탈퇴했는데 카드에서 돈이 나가는" 상황이 된다.
 *
 * ⚠️ 이 확인은 안내용이다. 실제 차단은 delete-user Edge Function 이 서버에서 한다.
 */
export async function checkAccountDeletable(): Promise<AccountDeletionCheck> {
  const fallback: AccountDeletionCheck = {
    deletable: false,
    reason: 'CHECK_FAILED',
    isOwner: false,
    orgName: null,
    memberCount: 0,
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...fallback, reason: 'NOT_AUTHENTICATED' };

  // 081 마이그레이션 적용 후 supabase gen types 로 타입 재생성 필요
  const { data, error } = await (supabase.rpc as CallableFunction)('check_account_deletable');

  if (error) {
    if (__DEV__) console.warn('[AppError] check_account_deletable:', error.message);
    // 확인에 실패하면 보수적으로 막는다 — 잘못 지우는 것보다 낫다
    return fallback;
  }

  const result = data as {
    deletable: boolean;
    reason?: string;
    is_owner?: boolean;
    org_name?: string;
    member_count?: number;
  };

  return {
    deletable: !!result?.deletable,
    reason: (result?.reason as AccountDeletionCheck['reason']) ?? null,
    isOwner: !!result?.is_owner,
    orgName: result?.org_name ?? null,
    memberCount: result?.member_count ?? 0,
  };
}

/**
 * 회원 탈퇴.
 *
 * delete-user Edge Function 이 활성 구독을 다시 확인하고, Storage 녹음 파일을 지운 뒤
 * auth.users 를 삭제한다. auth.users → public.users → scripts/practices/exam_sessions
 * 로 CASCADE 되어 학습 데이터가 함께 사라진다.
 *
 * 학원을 소유했다면 organizations.owner_id 가 NULL 이 되고 트리거가 학원을
 * soft delete 한다 (081).
 */
export async function deleteAccount(): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new AppError('AUTH_REQUIRED') };

  const { error } = await invokeFunction<{ success: boolean }>('delete-user', {});

  if (error) {
    // 서버가 활성 구독을 이유로 거부한 경우 (409)
    if (error.message?.includes('SUBSCRIPTION_ACTIVE')) {
      return { error: new Error('구독을 먼저 해지해 주세요.') };
    }
    return { error: classifyError(error, { resource: 'user' }) };
  }

  return { error: null };
}
