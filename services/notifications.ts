import { supabase } from '@/lib/supabase';
import type { NotificationType } from '@/lib/types';
import { AppError, classifyError } from '@/lib/errors';

// ============================================================================
// Types
// ============================================================================

interface NotifyActionResult {
  success: boolean;
  notification_log_id?: string;
  already_exists?: boolean;
  error?: string;
}

// ============================================================================
// 알림 생성 (RPC)
// ============================================================================

/**
 * 알림 생성 요청 (서버에서 수신자 결정 + 소유권 검증)
 * - practice_completed: resource_id = practice.id
 * - teacher_feedback: resource_id = practice.id
 * - new_script: resource_id = script.id
 */
export async function notifyAction(
  type: NotificationType,
  resourceId: string
): Promise<NotifyActionResult> {
  try {
    // notify_action is defined in migration 011 but not yet in auto-generated database.types.ts
    const { data, error } = await (supabase.rpc as CallableFunction)('notify_action', {
      p_type: type,
      p_resource_id: resourceId,
    });

    if (error) {
      return { success: false, error: classifyError(error, { resource: 'notification' }).userMessage };
    }

    return data as unknown as NotifyActionResult;
  } catch (err) {
    return { success: false, error: classifyError(err, { resource: 'notification' }).userMessage };
  }
}

// ============================================================================
// 알림 배달 (Edge Function) - fire-and-forget
// ============================================================================

/**
 * 알림 배달 요청 (Expo Push API)
 * fire-and-forget: 실패해도 알림은 앱 내에서 확인 가능
 */
export function deliverNotification(notificationLogId: string): void {
  supabase.functions
    .invoke('deliver-notification', {
      body: { notificationLogId },
    })
    .catch((err) => {
      if (__DEV__) console.warn('[AppError] deliver-notification:', err);
    });
}

// ============================================================================
// 알림 조회
// ============================================================================

/**
 * 내 알림 목록 조회
 */
export async function getMyNotifications(limit = 20): Promise<{
  data: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    data: Record<string, unknown> | null;
    read_at: string | null;
    created_at: string;
  }> | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase
    .from('notification_logs')
    .select('id, type, title, body, data, read_at, created_at:sent_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'notification' }) };
  }

  return {
    data: (data || []).map((n) => ({
      ...n,
      created_at: n.created_at || new Date().toISOString(),
      data: n.data as Record<string, unknown> | null,
    })),
    error: null,
  };
}

/**
 * 읽지 않은 알림 수 조회
 */
export async function getUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notification_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)
    .is('deleted_at', null);

  if (error) return 0;
  return count || 0;
}

/**
 * 알림 읽음 처리
 */
export async function markNotificationRead(notificationId: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new AppError('AUTH_REQUIRED') };

  const { error } = await supabase
    .from('notification_logs')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id);

  if (error) return { error: classifyError(error, { resource: 'notification' }) };
  return { error: null };
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllNotificationsRead(): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new AppError('AUTH_REQUIRED') };

  const { error } = await supabase
    .from('notification_logs')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
    .is('deleted_at', null);

  if (error) return { error: classifyError(error, { resource: 'notification' }) };
  return { error: null };
}
