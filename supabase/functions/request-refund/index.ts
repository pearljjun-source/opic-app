// Edge Function: request-refund
// 용도: 관리자 환불 처리 (TOSS Payments 취소 API 호출)
// 입력: { paymentId: string, reason: string, amount?: number }
// 출력: { success: boolean, refundAmount: number }
//
// 환불 정책:
// - 월간 결제: 환불 불가 (해지 시 현재 주기 끝까지 이용)
// - 연간 결제 14일 이내: 전액 환불
// - 연간 결제 14일 이후: 환불 불가
// - 결제 오류/이중 결제: 관리자 강제 전액 환불 (forceRefund=true)
//
// 보안:
// - super_admin만 호출 가능 (is_super_admin RPC 검증)
// - TOSS cancel API 호출 후 payment_history + subscription 상태 업데이트
// - 환불 사유 기록 (payment_history.failure_reason 필드 재활용)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';
import { TOSS_API_BASE } from '../_shared/constants.ts';

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const tossSecretKey = Deno.env.get('TOSS_SECRET_KEY');
    if (!tossSecretKey) {
      throw new Error('TOSS_SECRET_KEY is not configured');
    }

    // 인증 확인
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    // Service Role 클라이언트
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // super_admin 권한 확인
    const { data: isSA } = await supabaseAdmin.rpc('is_super_admin', { p_user_id: user.id });
    if (!isSA) {
      return new Response(
        JSON.stringify({ error: 'ADMIN_ONLY' }),
        { status: 403, headers: jsonHeaders }
      );
    }

    const { paymentId, reason, forceRefund = false } = await req.json();
    if (!paymentId || !reason) {
      return new Response(
        JSON.stringify({ error: 'paymentId and reason are required' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // 결제 이력 조회
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payment_history')
      .select('*, subscriptions!payment_history_subscription_id_fkey(*, subscription_plans!subscriptions_plan_id_fkey(*))')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'PAYMENT_NOT_FOUND' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    // 이미 환불된 결제
    if (payment.status === 'refunded') {
      return new Response(
        JSON.stringify({ error: 'ALREADY_REFUNDED' }),
        { status: 409, headers: jsonHeaders }
      );
    }

    // paid 상태만 환불 가능
    if (payment.status !== 'paid') {
      return new Response(
        JSON.stringify({ error: 'INVALID_PAYMENT_STATUS', detail: `Status: ${payment.status}` }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // provider_payment_id 필수 (TOSS paymentKey)
    if (!payment.provider_payment_id) {
      return new Response(
        JSON.stringify({ error: 'NO_PROVIDER_PAYMENT_ID' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const subscription = payment.subscriptions;

    // 환불 정책 검증 (forceRefund가 아닌 경우)
    if (!forceRefund && subscription) {
      const billingCycle = subscription.billing_cycle || 'monthly';
      const paidAt = new Date(payment.paid_at || payment.created_at);
      const daysSincePaid = Math.floor((Date.now() - paidAt.getTime()) / (1000 * 60 * 60 * 24));

      if (billingCycle === 'monthly') {
        return new Response(
          JSON.stringify({
            error: 'REFUND_NOT_ALLOWED',
            detail: '월간 결제는 환불이 불가합니다. 해지 시 현재 결제 주기가 끝날 때까지 서비스를 이용할 수 있습니다.',
          }),
          { status: 400, headers: jsonHeaders }
        );
      }

      if (billingCycle === 'yearly' && daysSincePaid > 14) {
        return new Response(
          JSON.stringify({
            error: 'REFUND_PERIOD_EXPIRED',
            detail: '연간 결제는 결제일로부터 14일 이내에만 환불이 가능합니다.',
          }),
          { status: 400, headers: jsonHeaders }
        );
      }
    }

    // TOSS 결제 취소 API 호출
    const authHeader = 'Basic ' + btoa(`${tossSecretKey}:`);
    const cancelRes = await fetch(
      `${TOSS_API_BASE}/payments/${payment.provider_payment_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelReason: reason,
        }),
      }
    );

    if (!cancelRes.ok) {
      const cancelError = await cancelRes.json();
      logger.error('Toss cancel API error', cancelError);
      return new Response(
        JSON.stringify({
          error: 'TOSS_CANCEL_FAILED',
          detail: cancelError.message || 'TOSS 결제 취소 실패',
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const cancelData = await cancelRes.json();

    // payment_history 상태 업데이트
    await supabaseAdmin
      .from('payment_history')
      .update({
        status: 'refunded',
        failure_reason: `[환불] ${reason}`,
      })
      .eq('id', paymentId);

    // 구독 상태 업데이트 (환불 시 구독 취소)
    if (subscription) {
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);
    }

    logger.info('Refund processed', {
      paymentId,
      amount: payment.amount,
      reason,
      forceRefund,
      adminId: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        refundAmount: payment.amount,
        cancelData: {
          paymentKey: cancelData.paymentKey,
          cancelAmount: cancelData.cancels?.[0]?.cancelAmount,
          canceledAt: cancelData.cancels?.[0]?.canceledAt,
        },
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    logger.error('request-refund error', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
