import { supabase } from '@/lib/supabase';
import type { MessageTargetType } from '@/lib/types';
import { classifyError, classifyRpcError } from '@/lib/errors';
import { deliverNotification } from './notifications';

// ============================================================================
// Types
// ============================================================================

export interface ReceivedMessage {
  id: string;
  title: string | null;
  body: string;
  target_type: string;
  created_at: string;
  read_at: string | null;
  sender_name: string;
  class_name: string | null;
}

export interface SentMessage {
  id: string;
  title: string | null;
  body: string;
  target_type: string;
  created_at: string;
  target_name: string;
  recipient_count: number;
  read_count: number;
}

// ============================================================================
// 메시지 발송
// ============================================================================

export async function sendMessage(params: {
  targetType: MessageTargetType;
  targetId: string;
  title?: string;
  body: string;
}): Promise<{ data: { messageId: string; recipientCount: number } | null; error: string | null }> {
  try {
    const { data, error } = await (supabase.rpc as CallableFunction)('send_message', {
      p_target_type: params.targetType,
      p_target_id: params.targetId,
      p_title: params.title || null,
      p_body: params.body,
    });

    if (error) {
      return { data: null, error: classifyError(error, { resource: 'message' }).userMessage };
    }

    if (data?.error) {
      return { data: null, error: classifyRpcError(data.error, { resource: 'message' }).userMessage };
    }

    // 알림 배달 (fire-and-forget) — RPC 내에서 notification_logs에 INSERT 했으므로 배달만
    // notification_log는 send_message RPC 내에서 생성됨
    // deliver-notification은 notification_log_id가 필요하므로 여기서는 생략
    // (학생이 앱에서 직접 수신함 조회)

    return {
      data: { messageId: data.message_id, recipientCount: data.recipient_count },
      error: null,
    };
  } catch (err) {
    return { data: null, error: classifyError(err, { resource: 'message' }).userMessage };
  }
}

// ============================================================================
// 수신 메시지 조회 (학생)
// ============================================================================

export async function getMyMessages(
  limit = 20,
  offset = 0
): Promise<{ data: ReceivedMessage[] | null; error: string | null }> {
  try {
    const { data, error } = await (supabase.rpc as CallableFunction)('get_my_messages', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return { data: null, error: classifyError(error, { resource: 'message' }).userMessage };
    }

    if (data?.error) {
      return { data: null, error: classifyRpcError(data.error, { resource: 'message' }).userMessage };
    }

    return { data: data.messages as ReceivedMessage[], error: null };
  } catch (err) {
    return { data: null, error: classifyError(err, { resource: 'message' }).userMessage };
  }
}

// ============================================================================
// 발송 이력 조회 (강사)
// ============================================================================

export async function getSentMessages(
  limit = 20,
  offset = 0
): Promise<{ data: SentMessage[] | null; error: string | null }> {
  try {
    const { data, error } = await (supabase.rpc as CallableFunction)('get_sent_messages', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return { data: null, error: classifyError(error, { resource: 'message' }).userMessage };
    }

    if (data?.error) {
      return { data: null, error: classifyRpcError(data.error, { resource: 'message' }).userMessage };
    }

    return { data: data.messages as SentMessage[], error: null };
  } catch (err) {
    return { data: null, error: classifyError(err, { resource: 'message' }).userMessage };
  }
}

// ============================================================================
// 읽음 처리
// ============================================================================

export async function markMessageRead(messageId: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await (supabase.rpc as CallableFunction)('mark_message_read', {
      p_message_id: messageId,
    });

    if (error) {
      return { error: classifyError(error, { resource: 'message' }).userMessage };
    }

    return { error: null };
  } catch (err) {
    return { error: classifyError(err, { resource: 'message' }).userMessage };
  }
}

// ============================================================================
// 읽지 않은 메시지 수
// ============================================================================

export async function getUnreadMessageCount(): Promise<number> {
  try {
    const { data, error } = await (supabase.rpc as CallableFunction)('get_unread_message_count');
    if (error) return 0;
    return (data as number) || 0;
  } catch {
    return 0;
  }
}
