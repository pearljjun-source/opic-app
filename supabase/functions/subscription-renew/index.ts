// Edge Function: subscription-renew
// 용도: 월간 자동 갱신 (pg_cron 매일 자정 호출)
// 입력: 없음 (서버 간 호출)
// 처리:
//   - current_period_end <= now() + 1일 AND status IN ('active','past_due') 조회
//   - 토스 빌링 API로 결제 실행
//   - 성공: period 연장, pending_plan_id 적용 (다운그레이드)
//   - 실패: past_due (grace 7일) → 14일 후 canceled
//   - cancel_at_period_end 만료 구독 → canceled

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
    const results = { renewed: 0, failed: 0, canceled: 0, downgraded: 0, notified: 0 };

    // Dunning 알림 헬퍼: org owner에게 푸시 알림 전송
    async function sendDunningNotification(
      orgId: string,
      ownerId: string,
      day: number,
      subId: string
    ) {
      const messages: Record<number, { title: string; body: string }> = {
        0: {
          title: '결제 실패',
          body: '구독 결제가 실패했습니다. 결제 수단을 확인해 주세요.',
        },
        3: {
          title: '결제 재시도 안내',
          body: '아직 결제가 처리되지 않았습니다. 결제 수단을 변경해 주세요.',
        },
        7: {
          title: '서비스 이용 제한 예정',
          body: '7일 내 결제 미완료 시 서비스가 제한됩니다. 결제 수단을 확인해 주세요.',
        },
        14: {
          title: '구독이 만료되었습니다',
          body: '결제 실패로 구독이 종료되었습니다. 데이터는 30일간 보존됩니다.',
        },
      };

      const msg = messages[day];
      if (!msg) return;

      // notification_logs에 직접 INSERT (서비스 롤, RLS bypass)
      const resourceId = `dunning_${subId}_day${day}`;
      const { data: notif } = await supabaseAdmin
        .from('notification_logs')
        .insert({
          user_id: ownerId,
          type: 'payment_failed',
          title: msg.title,
          body: msg.body,
          data: { subscription_id: subId, dunning_day: day, org_id: orgId },
          created_by: ownerId,
          resource_id: resourceId,
        })
        .select('id')
        .single();

      if (!notif) return; // ON CONFLICT 등으로 중복 시 skip

      // push_token 조회 및 Expo Push 발송
      const { data: owner } = await supabaseAdmin
        .from('users')
        .select('push_token')
        .eq('id', ownerId)
        .single();

      if (owner?.push_token) {
        try {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: owner.push_token,
              title: msg.title,
              body: msg.body,
              data: { type: 'payment_failed', subscription_id: subId },
              sound: 'default',
              channelId: 'default',
            }),
          });
        } catch (pushErr) {
          console.error('Push notification failed:', pushErr);
        }
      }

      // sent_at 업데이트
      await supabaseAdmin
        .from('notification_logs')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', notif.id);

      results.notified++;
    }

    for (const sub of dueSubs) {
      const plan = sub.subscription_plans;
      if (!sub.billing_key || !plan) {
        results.failed++;
        continue;
      }

      // pending_plan_id가 있으면 다운그레이드 적용 (갱신 시 새 플랜 가격으로 결제)
      let renewPlan = plan;
      if (sub.pending_plan_id && sub.pending_plan_id !== plan.id) {
        const { data: newPlan } = await supabaseAdmin
          .from('subscription_plans')
          .select('*')
          .eq('id', sub.pending_plan_id)
          .single();
        if (newPlan) {
          renewPlan = newPlan;
        }
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
            amount: renewPlan.price_monthly,
            orderId,
            orderName: `Speaky ${renewPlan.name} 구독 갱신`,
          }),
        });

        if (payRes.ok) {
          const payData = await payRes.json();

          // 구독 기간 연장
          const newStart = new Date(sub.current_period_end);
          const newEnd = new Date(newStart);
          newEnd.setMonth(newEnd.getMonth() + 1);

          const updateData: Record<string, unknown> = {
            status: 'active',
            current_period_start: newStart.toISOString(),
            current_period_end: newEnd.toISOString(),
            updated_at: new Date().toISOString(),
          };

          // 다운그레이드 적용: pending_plan_id → plan_id, pending 클리어
          if (sub.pending_plan_id && renewPlan.id !== plan.id) {
            updateData.plan_id = renewPlan.id;
            updateData.pending_plan_id = null;
            results.downgraded++;
          }

          await supabaseAdmin.from('subscriptions').update(updateData).eq('id', sub.id);

          // 결제 이력
          await supabaseAdmin.from('payment_history').insert({
            subscription_id: sub.id,
            user_id: sub.user_id,
            amount: renewPlan.price_monthly,
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

          // Dunning: dunning_started_at 기반 마일스톤 알림 + 14일 후 canceled
          const dunningStart = sub.dunning_started_at
            ? new Date(sub.dunning_started_at)
            : new Date();
          const daysSinceDunning = sub.dunning_started_at
            ? Math.floor((Date.now() - dunningStart.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          if (daysSinceDunning >= 14) {
            // 14일 이상 실패 → canceled
            await supabaseAdmin.from('subscriptions').update({
              status: 'canceled',
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', sub.id);
            results.canceled++;

            // Day 14 취소 알림
            if (sub.organization_id) {
              await sendDunningNotification(sub.organization_id, sub.user_id, 14, sub.id);
            }
          } else {
            // past_due로 변경 + dunning_started_at 설정 (첫 실패 시)
            if (sub.status !== 'past_due') {
              await supabaseAdmin.from('subscriptions').update({
                status: 'past_due',
                dunning_started_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq('id', sub.id);
            }
            results.failed++;

            // 마일스톤 알림 (Day 0, 3, 7)
            if (sub.organization_id && [0, 3, 7].includes(daysSinceDunning)) {
              await sendDunningNotification(sub.organization_id, sub.user_id, daysSinceDunning, sub.id);
            }
          }

          // 실패 이력
          await supabaseAdmin.from('payment_history').insert({
            subscription_id: sub.id,
            user_id: sub.user_id,
            amount: renewPlan.price_monthly,
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
