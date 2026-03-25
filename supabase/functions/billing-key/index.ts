// Edge Function: billing-key
// 용도: 토스페이먼츠 빌링키 발급 + 첫 결제
// 입력: { planKey: string, authKey: string, orgId: string }
// 출력: { subscriptionId: string }
//
// 보안:
// - orgId로 org owner 인지 검증 (인가)
// - 서버에서 plan_key로 금액 조회 (클라이언트 금액 불신)
// - authKey → 토스 API로 빌링키 교환
// - 실패 시 subscription 미생성 (롤백)
// - Toss customerKey = user.id (외부 제약, 변경 불가)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';
import { encryptValue } from '../_shared/crypto.ts';

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

  try {
    const tossSecretKey = Deno.env.get('TOSS_SECRET_KEY');
    if (!tossSecretKey) {
      throw new Error('TOSS_SECRET_KEY is not configured');
    }

    // 암호화 키 사전 검증 (결제 후 DB 저장 실패 방지)
    const billingEncKey = Deno.env.get('BILLING_ENCRYPTION_KEY');
    if (!billingEncKey || billingEncKey.length !== 64) {
      throw new Error('BILLING_ENCRYPTION_KEY is not configured');
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
      throw new Error('Unauthorized');
    }

    const { planKey, authKey, orgId, billingCycle = 'monthly', startTrial = false } = await req.json();
    if (!planKey || !authKey || !orgId) {
      return new Response(
        JSON.stringify({ error: 'planKey, authKey, and orgId are required' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';

    // Service Role 클라이언트
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 요청자가 해당 org의 owner인지 확인
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .is('deleted_at', null)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'NOT_ORG_OWNER' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 서버에서 플랜 가격 조회 (클라이언트 금액 불신)
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('plan_key', planKey)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'PLAN_NOT_FOUND' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 이미 활성 유료 구독이 있는지 확인 (organization 기반)
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, subscription_plans!subscriptions_plan_id_fkey(plan_key)')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing'])
      .single();

    if (existingSub) {
      const existingPlanKey = (existingSub.subscription_plans as any)?.plan_key;
      const existingStatus = existingSub.status;
      // free 또는 trialing 구독은 유료 전환 허용, 이미 유료 active면 차단
      if (existingPlanKey && existingPlanKey !== 'free' && existingStatus !== 'trialing') {
        return new Response(
          JSON.stringify({ error: 'ALREADY_SUBSCRIBED' }),
          { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
    }

    // Race Condition 방지: incomplete 상태 구독을 먼저 생성 (UNIQUE 제약으로 동시 요청 차단)
    const { data: lockSub, error: lockError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: user.id,
        organization_id: orgId,
        plan_id: plan.id,
        status: 'incomplete',
        billing_provider: 'toss',
        billing_cycle: cycle,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (lockError) {
      logger.error('Subscription lock insert failed (likely concurrent request)', lockError);
      return new Response(
        JSON.stringify({ error: 'ALREADY_SUBSCRIBED' }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const lockSubId = lockSub.id;

    // 토스페이먼츠: authKey → 빌링키 교환
    const authHeader = 'Basic ' + btoa(`${tossSecretKey}:`);
    const billingRes = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authKey,
        customerKey: user.id,
      }),
    });

    if (!billingRes.ok) {
      const billingError = await billingRes.json();
      logger.error('Toss billing key error', billingError);
      // 빌링키 발급 실패: incomplete 구독 정리
      await supabaseAdmin.from('subscriptions').delete().eq('id', lockSubId);
      return new Response(
        JSON.stringify({ error: 'BILLING_KEY_FAILED', detail: billingError.message }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const billingData = await billingRes.json();
    const billingKey = billingData.billingKey;

    // 빌링키를 incomplete 구독에 즉시 저장 (웹훅 reconciliation용)
    await supabaseAdmin
      .from('subscriptions')
      .update({ billing_key: await encryptValue(billingKey) })
      .eq('id', lockSubId);

    // 첫 결제 실행 (월간/연간에 따라 금액 결정)
    const amount = cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
    // 멱등성 키: lockSubId 기반으로 동일 요청에 대해 TOSS가 중복 결제 거부
    const orderId = `order_${orgId.slice(0, 8)}_${planKey}_${cycle}_${lockSubId.slice(0, 8)}`;

    // orderId를 incomplete 구독에 저장 (웹훅 reconciliation에서 매칭용)
    await supabaseAdmin
      .from('subscriptions')
      .update({ provider_subscription_id: orderId })
      .eq('id', lockSubId);

    const paymentRes = await fetch('https://api.tosspayments.com/v1/billing/' + billingKey, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Idempotency-Key': orderId,
      },
      body: JSON.stringify({
        customerKey: user.id,
        amount,
        orderId,
        orderName: `Speaky ${plan.name} 구독`,
        taxFreeAmount: 0,
      }),
    });

    const paymentResBody = await paymentRes.json();

    if (!paymentRes.ok) {
      // Idempotency-Key 중복: 이미 결제 완료된 요청 → 성공으로 처리
      if (paymentResBody.code === 'ALREADY_PROCESSED_PAYMENT') {
        logger.info('Already processed payment, treating as success', { orderId });
        // incomplete 구독은 webhook이 처리했거나 아래에서 활성화
      } else {
        logger.error('Toss payment error', paymentResBody);
        // 결제 실패: incomplete 구독 정리
        await supabaseAdmin.from('subscriptions').delete().eq('id', lockSubId);
        return new Response(
          JSON.stringify({ error: 'BILLING_PAYMENT_FAILED', detail: paymentResBody.message }),
          { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
    }

    const paymentData = paymentResBody;

    // 결제 응답 검증
    if (!paymentData.paymentKey || paymentData.status !== 'DONE') {
      logger.error('Unexpected payment response', paymentData);
      await supabaseAdmin.from('subscriptions').delete().eq('id', lockSubId);
      return new Response(
        JSON.stringify({ error: 'BILLING_PAYMENT_FAILED', detail: 'Invalid payment response' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 구독 생성 (월간: +1개월, 연간: +12개월, 트라이얼: 7일 후 시작)
    const now = new Date();
    const periodEnd = new Date(now);
    if (cycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // 기존 free/trialing 구독 삭제 (유료 전환)
    // free active 구독 삭제
    const freePlanIds = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('plan_key', 'free')
      .then(r => (r.data || []).map((p: any) => p.id));

    if (freePlanIds.length > 0) {
      await supabaseAdmin
        .from('subscriptions')
        .delete()
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .in('plan_id', freePlanIds);
    }

    // trialing 구독 삭제 (트라이얼 → 유료 전환)
    await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('organization_id', orgId)
      .eq('status', 'trialing')
      .neq('id', lockSubId); // 방금 생성한 incomplete 구독은 제외

    // incomplete → active 전환 (결제 성공, billing_key + orderId는 이미 저장됨)
    // 빌링키 결제는 TOSS 웹훅이 오지 않으므로 여기서 반드시 성공해야 함
    // DB 일시 장애 대비: 최대 3회 재시도 후 환불
    let subscription: { id: string } | null = null;
    let activationError: unknown = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data: sub, error: err } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq('id', lockSubId)
        .eq('status', 'incomplete')  // CAS: incomplete인 경우에만 전환
        .select('id')
        .single();

      if (!err && sub) {
        subscription = sub;
        activationError = null;
        break;
      }

      activationError = err;

      if (attempt < 3) {
        logger.warn(`Subscription activation attempt ${attempt} failed, retrying...`, {
          subscriptionId: lockSubId, error: err?.message,
        });
        // 1초, 2초 대기 후 재시도
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }

    if (!subscription) {
      // 3회 재시도 모두 실패 → 환불
      // 단, 재시도 중 성공했을 가능성 확인 (CAS 특성상 이미 active면 매칭 안 됨)
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id, status')
        .eq('id', lockSubId)
        .single();

      if (currentSub?.status === 'active') {
        // 재시도 중 하나가 실제로는 성공했지만 응답을 못 받은 경우
        logger.info('Subscription already active after retries', { subscriptionId: lockSubId });
        subscription = { id: lockSubId };
      } else {
        // 진짜 복구 불가 → TOSS 결제 취소(환불)
        logger.error('Subscription activation failed after 3 retries — attempting refund', activationError);
        try {
          await fetch(`https://api.tosspayments.com/v1/payments/${(paymentData as any).paymentKey}/cancel`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'Idempotency-Key': `refund_${orderId}`,
            },
            body: JSON.stringify({ cancelReason: 'DB 구독 활성화 3회 실패로 인한 자동 환불' }),
          });
          logger.info('Auto-refund completed for failed subscription activation');
        } catch (refundErr) {
          logger.error('Auto-refund also failed — manual intervention needed', {
            paymentKey: (paymentData as any).paymentKey,
            orderId,
            userId: user.id,
            orgId,
            amount,
          });
        }
        // incomplete 구독 정리
        await supabaseAdmin.from('subscriptions').delete().eq('id', lockSubId);
        throw new Error('Failed to activate subscription');
      }
    }

    // 결제 이력 생성 (UNIQUE 충돌 = webhook이 이미 생성 → 무시)
    const { error: payHistError } = await supabaseAdmin.from('payment_history').insert({
      subscription_id: subscription.id,
      user_id: user.id,
      amount,
      currency: 'KRW',
      status: 'paid',
      provider_payment_id: paymentData.paymentKey,
      payment_method: paymentData.method || 'card',
      card_last4: paymentData.card?.number?.slice(-4) || null,
      receipt_url: paymentData.receipt?.url || null,
      paid_at: new Date().toISOString(),
    });

    if (payHistError) {
      // UNIQUE 충돌(23505)은 webhook이 이미 생성한 경우 → 정상
      if (payHistError.code !== '23505') {
        logger.error('payment_history insert failed', {
          paymentKey: paymentData.paymentKey,
          subscriptionId: subscription.id,
          error: payHistError.message,
        });
      }
    }

    return new Response(
      JSON.stringify({ subscriptionId: subscription.id }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('billing-key error', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
