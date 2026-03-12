// Edge Function: update-billing-key
// 용도: 결제 수단 변경 (기존 빌링키 교체)
// 입력: { authKey: string, orgId: string }
// 출력: { success: true }
//
// 보안:
// - orgId로 org owner 인지 검증 (인가)
// - authKey → 토스 API로 새 빌링키 교환
// - 기존 활성/past_due 구독의 billing_key 업데이트
// - Toss customerKey = user.id (외부 제약, 변경 불가)

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

    const { authKey, orgId } = await req.json();
    if (!authKey || !orgId) {
      return new Response(
        JSON.stringify({ error: 'authKey and orgId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 기존 활성/past_due 구독 조회
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('organization_id', orgId)
      .in('status', ['active', 'past_due'])
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'NO_ACTIVE_SUBSCRIPTION' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 토스페이먼츠: authKey → 새 빌링키 교환
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

    // 구독의 billing_key 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({ billing_key: billingKey })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('Subscription update error:', updateError);
      throw new Error('Failed to update billing key');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('update-billing-key error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
