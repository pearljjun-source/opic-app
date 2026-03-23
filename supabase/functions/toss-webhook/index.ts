// Edge Function: toss-webhook
// 용도: 토스페이먼츠 웹훅 수신 및 처리
// 보안: HMAC-SHA256 서명 검증
// 멱등성: provider_payment_id로 중복 웹훅 무시
// 로깅: webhook_logs 테이블에 모든 이벤트 기록
//
// 이벤트 타입:
//   - DONE: 결제 완료 → payment_history.status='paid'
//   - CANCELED: 취소/환불 → payment_history.status='refunded'
//   - FAILED: 결제 실패 → payment_history.status='failed'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';
import { sendEmail, emailTemplates } from '../_shared/email.ts';

// HMAC-SHA256 서명 검증
async function verifySignature(body: string, signature: string, secretKey: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return computed === signature;
}

// 웹훅 로그 기록 헬퍼
async function logWebhook(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    event_type: string;
    payload: unknown;
    response: unknown;
    status_code: number;
    processing_time_ms: number;
    error_message?: string;
  }
) {
  try {
    await supabaseAdmin.from('webhook_logs').insert({
      event_type: params.event_type,
      payload: params.payload,
      response: params.response,
      status_code: params.status_code,
      processing_time_ms: params.processing_time_ms,
      error_message: params.error_message || null,
    });
  } catch (err) {
    logger.error('Failed to log webhook', err);
  }
}

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

  const startTime = Date.now();

  // supabaseAdmin을 try 바깥에서 초기화 (로깅에 필요)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const tossWebhookSecret = Deno.env.get('TOSS_WEBHOOK_SECRET');
    if (!tossWebhookSecret) {
      throw new Error('TOSS_WEBHOOK_SECRET is not configured');
    }

    // 서명 검증
    const bodyText = await req.text();
    const signature = req.headers.get('toss-signature') || '';

    const isValid = await verifySignature(bodyText, signature, tossWebhookSecret);
    if (!isValid) {
      logger.error('Invalid webhook signature');
      const response = { error: 'Invalid signature' };
      await logWebhook(supabaseAdmin, {
        event_type: 'INVALID_SIGNATURE',
        payload: { body_length: bodyText.length },
        response,
        status_code: 401,
        processing_time_ms: Date.now() - startTime,
        error_message: 'HMAC signature verification failed',
      });
      return new Response(
        JSON.stringify(response),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.parse(bodyText);
    const { eventType, data } = payload;

    const paymentKey = data?.paymentKey;
    if (!paymentKey) {
      const response = { message: 'No paymentKey, ignoring' };
      await logWebhook(supabaseAdmin, {
        event_type: eventType || 'UNKNOWN',
        payload,
        response,
        status_code: 200,
        processing_time_ms: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 멱등성: 이미 처리된 paymentKey인지 확인
    const { data: existingPayment } = await supabaseAdmin
      .from('payment_history')
      .select('id, status, subscription_id, user_id, amount')
      .eq('provider_payment_id', paymentKey)
      .single();

    let responseMessage = 'OK';

    switch (eventType) {
      case 'DONE': {
        if (existingPayment) {
          if (existingPayment.status === 'paid') {
            responseMessage = 'Already processed';
          } else {
            // pending → paid 업데이트
            await supabaseAdmin.from('payment_history').update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              card_last4: data.card?.number?.slice(-4) || null,
              receipt_url: data.receipt?.url || null,
            }).eq('id', existingPayment.id);

            // 결제 확인 이메일 발송
            await sendPaymentConfirmationEmail(supabaseAdmin, existingPayment, data);
          }
        }
        break;
      }

      case 'CANCELED': {
        if (existingPayment) {
          await supabaseAdmin.from('payment_history').update({
            status: 'refunded',
          }).eq('id', existingPayment.id);
        }
        break;
      }

      case 'FAILED': {
        if (existingPayment) {
          await supabaseAdmin.from('payment_history').update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            failure_reason: data.failure?.message || 'Payment failed',
          }).eq('id', existingPayment.id);
        }
        break;
      }

      default:
        logger.warn('Unhandled event type', eventType);
    }

    const response = { message: responseMessage };
    await logWebhook(supabaseAdmin, {
      event_type: eventType,
      payload,
      response,
      status_code: 200,
      processing_time_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('toss-webhook error', error);
    const response = { error: error.message || 'Internal server error' };
    await logWebhook(supabaseAdmin, {
      event_type: 'ERROR',
      payload: { error: error.message },
      response,
      status_code: 500,
      processing_time_ms: Date.now() - startTime,
      error_message: error.message,
    });
    return new Response(
      JSON.stringify(response),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});

// 결제 확인 이메일 헬퍼
async function sendPaymentConfirmationEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  payment: { user_id: string; amount: number; subscription_id: string },
  tossData: Record<string, unknown>
) {
  try {
    // 오너 정보 조회
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('id', payment.user_id)
      .single();

    if (!owner?.email) return;

    // 구독 + 플랜 정보
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('organization_id, subscription_plans!subscriptions_plan_id_fkey(name)')
      .eq('id', payment.subscription_id)
      .single();

    const planName = (sub?.subscription_plans as { name?: string })?.name || 'Speaky';

    // 조직명
    let orgName = 'Speaky';
    if (sub?.organization_id) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', sub.organization_id)
        .single();
      if (org) orgName = org.name;
    }

    const { subject, html } = emailTemplates.paymentConfirmation({
      orgName,
      planName,
      amount: payment.amount,
      cardLast4: (tossData.card as { number?: string })?.number?.slice(-4) || '****',
      receiptUrl: (tossData.receipt as { url?: string })?.url || null,
      paidAt: new Date().toISOString(),
    });

    await sendEmail(supabaseAdmin, {
      to: owner.email,
      subject,
      html,
      templateType: 'payment_confirmation',
      metadata: { org_id: sub?.organization_id, subscription_id: payment.subscription_id },
    });
  } catch (err) {
    logger.error('Failed to send payment confirmation email', err);
  }
}
