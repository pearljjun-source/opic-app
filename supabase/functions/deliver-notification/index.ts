// Edge Function: deliver-notification
// 용도: notification_logs에 이미 생성된 알림을 Expo Push API로 배달
// 입력: { notificationLogId: string }
// 동작: notification_logs 조회 → 수신자 push_token 조회 → Expo Push API 호출
// 보안: 이 함수는 알림을 "생성"하지 않음. 이미 RPC에서 생성된 알림을 "배달"만 함.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 인증 확인 (호출자가 로그인된 사용자인지)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // 요청 파싱
    const { notificationLogId } = await req.json();
    if (!notificationLogId) {
      throw new Error('notificationLogId is required');
    }

    // Service role client로 notification_logs 조회
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // notification_logs에서 해당 알림 조회 (created_by 포함)
    const { data: notification, error: notifError } = await serviceClient
      .from('notification_logs')
      .select('id, type, user_id, title, body, data, sent_at, created_by')
      .eq('id', notificationLogId)
      .is('deleted_at', null)
      .single();

    if (notifError || !notification) {
      throw new Error('Notification not found');
    }

    // 인가 확인: 알림을 생성한 행위자만 배달 트리거 가능
    if (notification.created_by !== user.id) {
      throw new Error('Unauthorized: not the notification creator');
    }

    // 이미 전송된 알림이면 skip
    if (notification.sent_at) {
      return new Response(
        JSON.stringify({ success: true, already_sent: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 수신자의 push_token 조회
    const { data: recipient, error: recipientError } = await serviceClient
      .from('users')
      .select('push_token')
      .eq('id', notification.user_id)
      .is('deleted_at', null)
      .single();

    if (recipientError || !recipient?.push_token) {
      // push_token이 없으면 sent_at만 업데이트하고 종료 (알림은 앱 내에서 확인 가능)
      await serviceClient
        .from('notification_logs')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', notificationLogId);

      return new Response(
        JSON.stringify({ success: true, pushed: false, reason: 'no_push_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Expo Push API 호출
    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipient.push_token,
        title: notification.title,
        body: notification.body || '',
        data: notification.data || {},
        sound: 'default',
        channelId: 'default',
      }),
    });

    const pushResult = await pushResponse.json();

    // DeviceNotRegistered 시 push_token 정리
    if (pushResult.data?.status === 'error' && pushResult.data?.details?.error === 'DeviceNotRegistered') {
      await serviceClient
        .from('users')
        .update({ push_token: null })
        .eq('id', notification.user_id);
    }

    // sent_at 업데이트
    await serviceClient
      .from('notification_logs')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', notificationLogId);

    return new Response(
      JSON.stringify({ success: true, pushed: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
