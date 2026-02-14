// Edge Function: subscription-renew
// 용도: 월간 자동 갱신 (pg_cron 매일 자정 호출)
// 입력: 없음 (서버 간 호출)
// 처리:
//   - current_period_end <= now() + 1일 AND status='active' 조회
//   - 토스 빌링 API로 결제 실행
//   - 성공: period 연장 / 실패: past_due → 3일 후 재시도 → 7일 canceled

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

    // Service Role (서버 간 호출이므로 사용자 인증 불필요)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 갱신 대상: 내일까지 만료 예정이고 취소 예약되지 않은 활성 구독
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: dueSubs, error: queryError } = await supabaseAdmin
      .from('subscriptions')
      .select('*, subscription_plans(*)')
      .lte('current_period_end', tomorrow.toISOString())
      .eq('cancel_at_period_end', false)
      .in('status', ['active', 'past_due']);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!dueSubs || dueSubs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions to renew', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = 'Basic ' + btoa(`${tossSecretKey}:`);
    const results = { renewed: 0, failed: 0, canceled: 0 };

    for (const sub of dueSubs) {
      const plan = sub.subscription_plans;
      if (!sub.billing_key || !plan) {
        results.failed++;
        continue;
      }

      const orderId = `renew_${sub.user_id.slice(0, 8)}_${Date.now()}`;

      try {
        // 토스 빌링 결제
        const payRes = await fetch(`https://api.tosspayments.com/v1/billing/${sub.billing_key}`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerKey: sub.user_id,
            amount: plan.price_monthly,
            orderId,
            orderName: `Speaky ${plan.name} 구독 갱신`,
          }),
        });

        if (payRes.ok) {
          const payData = await payRes.json();

          // 구독 기간 연장
          const newStart = new Date(sub.current_period_end);
          const newEnd = new Date(newStart);
          newEnd.setMonth(newEnd.getMonth() + 1);

          await supabaseAdmin.from('subscriptions').update({
            status: 'active',
            current_period_start: newStart.toISOString(),
            current_period_end: newEnd.toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', sub.id);

          // 결제 이력
          await supabaseAdmin.from('payment_history').insert({
            subscription_id: sub.id,
            user_id: sub.user_id,
            amount: plan.price_monthly,
            currency: 'KRW',
            status: 'paid',
            provider_payment_id: payData.paymentKey,
            payment_method: payData.method || 'card',
            card_last4: payData.card?.number?.slice(-4) || null,
            receipt_url: payData.receipt?.url || null,
            paid_at: new Date().toISOString(),
          });

          results.renewed++;
        } else {
          const payError = await payRes.json();
          console.error(`Payment failed for ${sub.id}:`, payError);

          // 실패 처리
          const daysSinceEnd = Math.floor(
            (Date.now() - new Date(sub.current_period_end).getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceEnd >= 7) {
            // 7일 이상 실패 → canceled
            await supabaseAdmin.from('subscriptions').update({
              status: 'canceled',
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', sub.id);
            results.canceled++;
          } else {
            // past_due로 변경 (재시도 대기)
            await supabaseAdmin.from('subscriptions').update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            }).eq('id', sub.id);
            results.failed++;
          }

          // 실패 이력
          await supabaseAdmin.from('payment_history').insert({
            subscription_id: sub.id,
            user_id: sub.user_id,
            amount: plan.price_monthly,
            currency: 'KRW',
            status: 'failed',
            failure_reason: payError.message || 'Payment failed',
            failed_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error(`Error processing sub ${sub.id}:`, err);
        results.failed++;
      }
    }

    // cancel_at_period_end인 만료된 구독 처리
    const { data: cancelingSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('cancel_at_period_end', true)
      .lte('current_period_end', new Date().toISOString())
      .eq('status', 'active');

    if (cancelingSubs && cancelingSubs.length > 0) {
      for (const cs of cancelingSubs) {
        await supabaseAdmin.from('subscriptions').update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        }).eq('id', cs.id);
        results.canceled++;
      }
    }

    return new Response(
      JSON.stringify({ message: 'Renewal complete', results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('subscription-renew error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
