// Edge Function: toss-webhook
// 용도: 토스페이먼츠 웹훅 수신 및 처리
// 보안:
//   - 결제 웹훅 (PAYMENT_STATUS_CHANGED): TOSS는 서명 미포함 → IP 기반 또는 payload 검증
//   - 정산 웹훅 (payout.changed 등): HMAC-SHA256 서명 검증
// 멱등성: provider_payment_id로 중복 웹훅 무시
// 로깅: webhook_logs 테이블에 모든 이벤트 기록
//
// TOSS 웹훅 이벤트:
//   - eventType: "PAYMENT_STATUS_CHANGED" → data.status: "DONE"/"CANCELED"/"FAILED" 등
//   - eventType: "DEPOSIT_CALLBACK" → 가상계좌 입금 (미사용)
//   - eventType: "PAYOUT_STATUS_CHANGED" → 정산 (서명 있음, 미사용)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';
import { sendEmail, emailTemplates } from '../_shared/email.ts';

// HMAC-SHA256 서명 검증 (TOSS 공식 스펙 준수)
// 헤더: tosspayments-webhook-signature (v1:base64sig 형식)
// 페이로드: body + ":" + tosspayments-webhook-transmission-time
// 비교: timing-safe (바이트 단위 XOR 누적)
async function verifySignature(body: string, req: Request, secretKey: string): Promise<boolean> {
  const signature = req.headers.get('tosspayments-webhook-signature') || '';
  const transmissionTime = req.headers.get('tosspayments-webhook-transmission-time') || '';

  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // TOSS 스펙: body + ":" + transmissionTime
  const payload = transmissionTime ? `${body}:${transmissionTime}` : body;
  const computed = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));

  // "v1:base64sig1,v1:base64sig2" 형식 파싱
  const signatures = signature.split(',').map(s => s.trim().replace(/^v1:/, ''));

  for (const sig of signatures) {
    try {
      const decoded = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
      if (timingSafeEqual(computed, decoded)) return true;
    } catch {
      // base64 디코딩 실패 → 다음 서명 시도
    }
  }
  return false;
}

// Timing-safe 바이트 비교 (타이밍 공격 방지)
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
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

    const bodyText = await req.text();

    // 서명 검증: TOSS 결제 웹훅(PAYMENT_STATUS_CHANGED)에는 서명 헤더가 없음
    // 서명은 정산 웹훅(payout.changed, seller.changed)에만 포함됨
    // 서명 헤더가 있는 경우에만 검증 (정산 웹훅 등)
    const hasSignature = !!req.headers.get('tosspayments-webhook-signature');
    if (hasSignature && tossWebhookSecret) {
      const isValid = await verifySignature(bodyText, req, tossWebhookSecret);
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
    }

    const payload = JSON.parse(bodyText);
    const { eventType, data } = payload;

    // TOSS 결제 웹훅: eventType="PAYMENT_STATUS_CHANGED", 실제 상태는 data.status
    // 레거시 호환: eventType이 직접 DONE/CANCELED/FAILED인 경우도 처리
    const paymentStatus = (eventType === 'PAYMENT_STATUS_CHANGED')
      ? data?.status   // TOSS v2: data.status = "DONE" | "CANCELED" | "ABORTED" | ...
      : eventType;     // 레거시 또는 직접 eventType

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

    switch (paymentStatus) {
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
        } else {
          // RECONCILIATION: 결제 성공했지만 payment_history가 없음
          // 동기 플로우가 결제 후 DB 저장 전에 실패한 경우
          const tossOrderId = data?.orderId;
          if (tossOrderId) {
            const { data: incompleteSub } = await supabaseAdmin
              .from('subscriptions')
              .select('id, user_id, organization_id, plan_id, billing_cycle, subscription_plans!subscriptions_plan_id_fkey(name, price_monthly, price_yearly)')
              .eq('provider_subscription_id', tossOrderId)
              .eq('status', 'incomplete')
              .single();

            if (incompleteSub) {
              logger.info('Webhook reconciliation: activating incomplete subscription', {
                subscriptionId: incompleteSub.id, orderId: tossOrderId, paymentKey,
              });

              const plan = incompleteSub.subscription_plans as any;
              const cycle = incompleteSub.billing_cycle || 'monthly';
              const amount = cycle === 'yearly' ? plan?.price_yearly : plan?.price_monthly;

              const now = new Date();
              const periodEnd = new Date(now);
              if (cycle === 'yearly') {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
              } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
              }

              // 기존 free 구독 삭제
              if (incompleteSub.organization_id) {
                const freePlanIds = await supabaseAdmin
                  .from('subscription_plans')
                  .select('id')
                  .eq('plan_key', 'free')
                  .then(r => (r.data || []).map((p: any) => p.id));

                if (freePlanIds.length > 0) {
                  await supabaseAdmin
                    .from('subscriptions')
                    .delete()
                    .eq('organization_id', incompleteSub.organization_id)
                    .eq('status', 'active')
                    .in('plan_id', freePlanIds);
                }
              }

              // incomplete → active (CAS: incomplete인 경우에만)
              await supabaseAdmin
                .from('subscriptions')
                .update({
                  status: 'active',
                  current_period_start: now.toISOString(),
                  current_period_end: periodEnd.toISOString(),
                })
                .eq('id', incompleteSub.id)
                .eq('status', 'incomplete');

              // 결제 이력 생성 (UNIQUE 충돌 = sync flow가 이미 생성 → 무시)
              const { error: phError } = await supabaseAdmin.from('payment_history').insert({
                subscription_id: incompleteSub.id,
                user_id: incompleteSub.user_id,
                amount: amount || (data?.totalAmount ?? 0),
                currency: 'KRW',
                status: 'paid',
                provider_payment_id: paymentKey,
                payment_method: data?.method || 'card',
                card_last4: data?.card?.number?.slice(-4) || null,
                receipt_url: data?.receipt?.url || null,
                paid_at: new Date().toISOString(),
              });
              if (phError && phError.code !== '23505') {
                logger.error('Reconciliation payment_history insert failed', phError);
              }

              await sendPaymentConfirmationEmail(supabaseAdmin, {
                user_id: incompleteSub.user_id,
                amount: amount || 0,
                subscription_id: incompleteSub.id,
              }, data);

              responseMessage = 'Reconciled incomplete subscription';
            } else {
              logger.warn('DONE webhook: no payment_history and no incomplete subscription', {
                paymentKey, orderId: tossOrderId,
              });
              responseMessage = 'No matching subscription found';
            }
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

      case 'ABORTED': {
        // TOSS: 결제 중단 (사용자 취소 등) — FAILED와 동일 처리
        if (existingPayment) {
          await supabaseAdmin.from('payment_history').update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            failure_reason: data.failure?.message || 'Payment aborted',
          }).eq('id', existingPayment.id);
        }
        break;
      }

      default:
        logger.warn('Unhandled payment status', { eventType, paymentStatus });
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
    const response = { error: 'Internal server error' };
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
