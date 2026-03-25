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
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';
import { decryptValue, isEncrypted } from '../_shared/crypto.ts';
import { sendEmail, emailTemplates } from '../_shared/email.ts';

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

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

    // ========== Stale incomplete 정리 (1시간 이상 된 incomplete 구독 삭제) ==========
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: staleSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('status', 'incomplete')
      .lt('created_at', oneHourAgo);

    if (staleSubs && staleSubs.length > 0) {
      const staleIds = staleSubs.map((s: { id: string }) => s.id);
      await supabaseAdmin
        .from('subscriptions')
        .delete()
        .in('id', staleIds);
      logger.info(`Cleaned up ${staleIds.length} stale incomplete subscriptions`);
    }

    // 갱신 대상: 내일까지 만료 예정이고 취소 예약되지 않은 활성 구독
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: dueSubs, error: queryError } = await supabaseAdmin
      .from('subscriptions')
      .select('*, subscription_plans!subscriptions_plan_id_fkey(*)')
      .lte('current_period_end', tomorrow.toISOString())
      .eq('cancel_at_period_end', false)
      .in('status', ['active', 'past_due']);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!dueSubs || dueSubs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions to renew', count: 0 }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = 'Basic ' + btoa(`${tossSecretKey}:`);
    const results: Record<string, number> = { renewed: 0, failed: 0, canceled: 0, downgraded: 0, notified: 0, trialExpired: 0 };

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
          logger.error('Push notification failed', pushErr);
        }
      }

      // sent_at 업데이트
      await supabaseAdmin
        .from('notification_logs')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', notif.id);

      // Dunning 이메일 발송
      const { data: ownerUser } = await supabaseAdmin
        .from('users')
        .select('email, name')
        .eq('id', ownerId)
        .single();

      if (ownerUser?.email) {
        // 조직명 조회
        const { data: ownerOrg } = await supabaseAdmin
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .single();

        const { subject, html } = emailTemplates.paymentFailure({
          orgName: ownerOrg?.name || 'Speaky',
          day,
        });

        await sendEmail(supabaseAdmin, {
          to: ownerUser.email,
          subject,
          html,
          templateType: 'dunning',
          metadata: { org_id: orgId, subscription_id: subId, dunning_day: day },
        });
      }

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

      // 멱등성 키: 같은 구독의 같은 기간 갱신은 동일 orderId → TOSS가 중복 거부
      const periodKey = new Date(sub.current_period_end).toISOString().slice(0, 10).replace(/-/g, '');
      const orderId = `renew_${sub.id.slice(0, 8)}_${periodKey}`;

      try {
        // billing_key 복호화 (암호화된 경우)
        const rawBillingKey = isEncrypted(sub.billing_key)
          ? await decryptValue(sub.billing_key)
          : sub.billing_key;

        // 토스 빌링 결제
        const payRes = await fetch(`https://api.tosspayments.com/v1/billing/${rawBillingKey}`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerKey: sub.user_id,
            amount: sub.billing_cycle === 'yearly' ? renewPlan.price_yearly : renewPlan.price_monthly,
            orderId,
            orderName: `Speaky ${renewPlan.name} 구독 갱신`,
          }),
        });

        const payResBody = await payRes.json();

        if (payRes.ok) {
          const payData = payResBody;

          // 구독 기간 연장 (billing_cycle에 따라 1개월/12개월)
          const newStart = new Date(sub.current_period_end);
          const newEnd = new Date(newStart);
          if (sub.billing_cycle === 'yearly') {
            newEnd.setFullYear(newEnd.getFullYear() + 1);
          } else {
            newEnd.setMonth(newEnd.getMonth() + 1);
          }

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
          const renewAmount = sub.billing_cycle === 'yearly' ? renewPlan.price_yearly : renewPlan.price_monthly;
          await supabaseAdmin.from('payment_history').insert({
            subscription_id: sub.id,
            user_id: sub.user_id,
            amount: renewAmount,
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
          const payError = payResBody;

          // TOSS 중복 결제 거부 (멱등성 키 중복) → 이미 결제 완료로 처리
          if (payError.code === 'ALREADY_PROCESSED_PAYMENT') {
            logger.info(`Already processed payment for ${sub.id}, skipping`, { orderId });
            results.renewed++;
            continue;
          }

          logger.error(`Payment failed for ${sub.id}`, payError);

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
          const failedAmount = sub.billing_cycle === 'yearly' ? renewPlan.price_yearly : renewPlan.price_monthly;
          await supabaseAdmin.from('payment_history').insert({
            subscription_id: sub.id,
            user_id: sub.user_id,
            amount: failedAmount,
            currency: 'KRW',
            status: 'failed',
            failure_reason: payError.message || 'Payment failed',
            failed_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        logger.error(`Error processing sub ${sub.id}`, err);
        results.failed++;
      }
    }

    // 트라이얼 만료 3일 전 이메일 알림
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const { data: expiringTrials } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, organization_id, trial_ends_at')
      .eq('status', 'trialing')
      .lte('trial_ends_at', threeDaysLater.toISOString())
      .gt('trial_ends_at', new Date().toISOString());

    if (expiringTrials && expiringTrials.length > 0) {
      for (const trial of expiringTrials) {
        const { data: trialOwner } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('id', trial.user_id)
          .single();

        if (trialOwner?.email && trial.trial_ends_at) {
          let orgName = 'Speaky';
          if (trial.organization_id) {
            const { data: trialOrg } = await supabaseAdmin
              .from('organizations')
              .select('name')
              .eq('id', trial.organization_id)
              .single();
            if (trialOrg) orgName = trialOrg.name;
          }

          const daysLeft = Math.ceil(
            (new Date(trial.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          const { subject, html } = emailTemplates.trialExpiryWarning({
            orgName,
            daysLeft,
            trialEndsAt: trial.trial_ends_at,
          });

          // resource_id로 중복 방지 (하루에 한 번만)
          const emailKey = `trial_expiry_${trial.id}_${new Date().toISOString().slice(0, 10)}`;
          const { data: existingLog } = await supabaseAdmin
            .from('email_logs')
            .select('id')
            .eq('template_type', 'trial_expiry')
            .eq('metadata->>subscription_id', trial.id)
            .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            .limit(1)
            .single();

          if (!existingLog) {
            await sendEmail(supabaseAdmin, {
              to: trialOwner.email,
              subject,
              html,
              templateType: 'trial_expiry',
              metadata: { org_id: trial.organization_id, subscription_id: trial.id },
            });
          }
        }
      }
    }

    // 트라이얼 만료 처리: trial_ends_at이 지난 trialing 구독을 Free로 전환
    const { data: expiredCount } = await supabaseAdmin.rpc('expire_trial_subscriptions');
    if (expiredCount && expiredCount > 0) {
      results.trialExpired = expiredCount;
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
        // 구독 + 오너 정보 조회 (이메일 발송용)
        const { data: cancelSub } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id, organization_id, current_period_end, subscription_plans!subscriptions_plan_id_fkey(name)')
          .eq('id', cs.id)
          .single();

        await supabaseAdmin.from('subscriptions').update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        }).eq('id', cs.id);
        results.canceled++;

        // 취소 확인 이메일
        if (cancelSub) {
          const { data: cancelOwner } = await supabaseAdmin
            .from('users')
            .select('email')
            .eq('id', cancelSub.user_id)
            .single();

          if (cancelOwner?.email) {
            let cancelOrgName = 'Speaky';
            if (cancelSub.organization_id) {
              const { data: cancelOrg } = await supabaseAdmin
                .from('organizations')
                .select('name')
                .eq('id', cancelSub.organization_id)
                .single();
              if (cancelOrg) cancelOrgName = cancelOrg.name;
            }

            const planName = (cancelSub.subscription_plans as { name?: string })?.name || 'Speaky';

            const { subject, html } = emailTemplates.cancellationConfirmation({
              orgName: cancelOrgName,
              planName,
              periodEnd: cancelSub.current_period_end,
            });

            await sendEmail(supabaseAdmin, {
              to: cancelOwner.email,
              subject,
              html,
              templateType: 'cancellation',
              metadata: { org_id: cancelSub.organization_id, subscription_id: cs.id },
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: 'Renewal complete', results }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('subscription-renew error', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
