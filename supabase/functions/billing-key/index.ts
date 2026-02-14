// Edge Function: billing-key
// 용도: 토스페이먼츠 빌링키 발급 + 첫 결제
// 입력: { planKey: string, authKey: string }
// 출력: { subscriptionId: string }
//
// 보안:
// - 서버에서 plan_key로 금액 조회 (클라이언트 금액 불신)
// - authKey → 토스 API로 빌링키 교환
// - 실패 시 subscription 미생성 (롤백)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
      throw new Error('Unauthorized');
    }

    const { planKey, authKey } = await req.json();
    if (!planKey || !authKey) {
      throw new Error('planKey and authKey are required');
    }

    // Service Role 클라이언트
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 이미 활성 구독이 있는지 확인
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .single();

    if (existingSub) {
      return new Response(
        JSON.stringify({ error: 'ALREADY_SUBSCRIBED' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      console.error('Toss billing key error:', billingError);
      return new Response(
        JSON.stringify({ error: 'BILLING_KEY_FAILED', detail: billingError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const billingData = await billingRes.json();
    const billingKey = billingData.billingKey;

    // 첫 결제 실행
    const amount = plan.price_monthly;
    const orderId = `order_${user.id.slice(0, 8)}_${Date.now()}`;

    const paymentRes = await fetch('https://api.tosspayments.com/v1/billing/' + billingKey, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerKey: user.id,
        amount,
        orderId,
        orderName: `Speaky ${plan.name} 구독`,
      }),
    });

    if (!paymentRes.ok) {
      const paymentError = await paymentRes.json();
      console.error('Toss payment error:', paymentError);
      return new Response(
        JSON.stringify({ error: 'BILLING_PAYMENT_FAILED', detail: paymentError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentData = await paymentRes.json();

    // 구독 생성
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        status: 'active',
        billing_provider: 'toss',
        billing_key: billingKey,
        provider_subscription_id: orderId,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select('id')
      .single();

    if (subError) {
      console.error('Subscription insert error:', subError);
      throw new Error('Failed to create subscription');
    }

    // 결제 이력 생성
    await supabaseAdmin.from('payment_history').insert({
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

    return new Response(
      JSON.stringify({ subscriptionId: subscription.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('billing-key error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
