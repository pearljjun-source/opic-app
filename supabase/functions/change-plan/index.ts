// Edge Function: change-plan
// 용도: 구독 플랜 변경 (업그레이드: 일할 결제, 다운그레이드: 다음 갱신 시 적용)
// 입력: { newPlanKey: string, orgId: string }
// 출력: { success: true, type: 'upgrade'|'downgrade', proratedAmount?: number }
//
// 보안:
// - orgId로 org owner 인지 검증 (인가)
// - 서버에서 plan_key로 금액 조회 (클라이언트 금액 불신)
// - 업그레이드: 일할 계산 후 토스 빌링 결제, 즉시 플랜 변경
// - 다운그레이드: pending_plan_id 설정, 다음 갱신 시 적용
// - 다운그레이드 시 현재 사용량이 새 플랜 한도 초과 여부 검증

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';
import { decryptValue, isEncrypted } from '../_shared/crypto.ts';

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

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

    const { newPlanKey, orgId } = await req.json();
    if (!newPlanKey || !orgId) {
      return new Response(
        JSON.stringify({ error: 'newPlanKey and orgId are required' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

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

    // 활성 구독 조회
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*, subscription_plans!subscriptions_plan_id_fkey(*)')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing'])
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'NO_ACTIVE_SUBSCRIPTION' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const currentPlan = subscription.subscription_plans;
    if (!currentPlan) {
      return new Response(
        JSON.stringify({ error: 'PLAN_NOT_FOUND', detail: 'Current plan not found' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 새 플랜 조회
    const { data: newPlan, error: newPlanError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('plan_key', newPlanKey)
      .eq('is_active', true)
      .single();

    if (newPlanError || !newPlan) {
      return new Response(
        JSON.stringify({ error: 'PLAN_NOT_FOUND', detail: 'New plan not found' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 동일 플랜 체크
    if (currentPlan.id === newPlan.id) {
      return new Response(
        JSON.stringify({ error: 'SAME_PLAN' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const isUpgrade = newPlan.price_monthly > currentPlan.price_monthly;

    if (isUpgrade) {
      // ========== 업그레이드: 일할 결제 후 즉시 플랜 변경 ==========

      if (!subscription.billing_key) {
        return new Response(
          JSON.stringify({ error: 'NO_BILLING_KEY' }),
          { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }

      // 일할 계산
      const now = new Date();
      const periodStart = new Date(subscription.current_period_start);
      const periodEnd = new Date(subscription.current_period_end);
      const totalDays = Math.max(
        1,
        Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
      );
      const daysRemaining = Math.max(
        0,
        Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      const priceDiff = newPlan.price_monthly - currentPlan.price_monthly;
      const proratedAmount = Math.round(priceDiff * (daysRemaining / totalDays));

      if (proratedAmount > 0) {
        // 토스 빌링 결제
        const authHeader = 'Basic ' + btoa(`${tossSecretKey}:`);
        const orderId = `upgrade_${user.id.slice(0, 8)}_${Date.now()}`;

        // billing_key 복호화 (암호화된 경우)
        const rawBillingKey = isEncrypted(subscription.billing_key)
          ? await decryptValue(subscription.billing_key)
          : subscription.billing_key;

        const paymentRes = await fetch(
          `https://api.tosspayments.com/v1/billing/${rawBillingKey}`,
          {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              customerKey: subscription.user_id,
              amount: proratedAmount,
              orderId,
              orderName: `Speaky ${currentPlan.name} → ${newPlan.name} 업그레이드 (일할)`,
            }),
          }
        );

        if (!paymentRes.ok) {
          const paymentError = await paymentRes.json();
          logger.error('Toss payment error', paymentError);
          return new Response(
            JSON.stringify({ error: 'BILLING_PAYMENT_FAILED', detail: paymentError.message }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          );
        }

        const paymentData = await paymentRes.json();

        // 결제 이력 생성
        await supabaseAdmin.from('payment_history').insert({
          subscription_id: subscription.id,
          user_id: subscription.user_id,
          amount: proratedAmount,
          currency: 'KRW',
          status: 'paid',
          provider_payment_id: paymentData.paymentKey,
          payment_method: paymentData.method || 'card',
          card_last4: paymentData.card?.number?.slice(-4) || null,
          receipt_url: paymentData.receipt?.url || null,
          paid_at: new Date().toISOString(),
        });
      }

      // 구독 플랜 즉시 변경 (기간은 유지)
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          plan_id: newPlan.id,
          pending_plan_id: null, // 업그레이드 시 대기 중인 다운그레이드 취소
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        logger.error('Subscription update error', updateError);
        throw new Error('Failed to update subscription');
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: 'upgrade',
          proratedAmount,
        }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    } else {
      // ========== 다운그레이드: 다음 갱신 시 적용 ==========

      // 현재 사용량이 새 플랜 한도를 초과하는지 검증
      // 학생 수 확인
      const { count: studentCount } = await supabaseAdmin
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('role', 'student')
        .is('deleted_at', null);

      if (studentCount !== null && studentCount > newPlan.max_students) {
        return new Response(
          JSON.stringify({
            error: 'DOWNGRADE_USAGE_EXCEEDED',
            detail: `현재 학생 수(${studentCount}명)가 새 플랜 한도(${newPlan.max_students}명)를 초과합니다. 다운그레이드 전에 학생 수를 줄여주세요.`,
          }),
          { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }

      // 스크립트 수 확인: 조직 소속 강사들의 스크립트 총합
      const { data: orgTeachers } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', orgId)
        .in('role', ['owner', 'teacher'])
        .is('deleted_at', null);

      const teacherIds = (orgTeachers || []).map((t: { user_id: string }) => t.user_id);

      let scriptCount = 0;
      if (teacherIds.length > 0) {
        const { count } = await supabaseAdmin
          .from('scripts')
          .select('*', { count: 'exact', head: true })
          .in('teacher_id', teacherIds)
          .is('deleted_at', null);
        scriptCount = count ?? 0;
      }

      if (scriptCount > newPlan.max_scripts) {
        return new Response(
          JSON.stringify({
            error: 'DOWNGRADE_USAGE_EXCEEDED',
            detail: `현재 스크립트 수(${scriptCount}개)가 새 플랜 한도(${newPlan.max_scripts}개)를 초과합니다. 다운그레이드 전에 스크립트 수를 줄여주세요.`,
          }),
          { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }

      // pending_plan_id 설정 (다음 갱신 시 적용)
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          pending_plan_id: newPlan.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        logger.error('Subscription update error', updateError);
        throw new Error('Failed to set pending plan');
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: 'downgrade',
        }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    logger.error('change-plan error', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
