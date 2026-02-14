// Edge Function: toss-webhook
// 용도: 토스페이먼츠 웹훅 수신 및 처리
// 보안: HMAC-SHA256 서명 검증
// 멱등성: provider_payment_id로 중복 웹훅 무시
//
// 이벤트 타입:
//   - DONE: 결제 완료 → payment_history.status='paid'
//   - CANCELED: 취소/환불 → payment_history.status='refunded'
//   - FAILED: 결제 실패 → payment_history.status='failed'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.parse(bodyText);
    const { eventType, data } = payload;

    // Service Role 클라이언트
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const paymentKey = data?.paymentKey;
    if (!paymentKey) {
      return new Response(
        JSON.stringify({ message: 'No paymentKey, ignoring' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 멱등성: 이미 처리된 paymentKey인지 확인
    const { data: existingPayment } = await supabaseAdmin
      .from('payment_history')
      .select('id, status')
      .eq('provider_payment_id', paymentKey)
      .single();

    switch (eventType) {
      case 'DONE': {
        if (existingPayment) {
          // 이미 paid면 무시
          if (existingPayment.status === 'paid') {
            return new Response(
              JSON.stringify({ message: 'Already processed' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          // pending → paid 업데이트
          await supabaseAdmin.from('payment_history').update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            card_last4: data.card?.number?.slice(-4) || null,
            receipt_url: data.receipt?.url || null,
          }).eq('id', existingPayment.id);
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
        console.log('Unhandled event type:', eventType);
    }

    return new Response(
      JSON.stringify({ message: 'OK' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('toss-webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
