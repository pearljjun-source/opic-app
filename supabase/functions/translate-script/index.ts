// Edge Function: translate-script
// 용도: Claude Haiku로 영어 스크립트를 한국어로 번역 → scripts.content_ko 캐싱
// 입력: { scriptId: string }
// 출력: { content_ko: string, cached: boolean }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkOrgEntitlement } from '../_shared/check-subscription.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    translation: {
      type: 'string',
      description: 'Natural Korean translation of the English script',
    },
  },
  required: ['translation'],
  additionalProperties: false,
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
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

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // 요청 파싱
    const { scriptId } = await req.json();
    if (!scriptId) {
      throw new Error('scriptId is required');
    }

    // Service Role 클라이언트
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 스크립트 조회 (소유권 검증: 본인 스크립트 또는 본인이 작성한 스크립트)
    const { data: script, error: scriptError } = await supabaseAdmin
      .from('scripts')
      .select('id, content, content_ko, student_id, teacher_id')
      .eq('id', scriptId)
      .eq('status', 'complete')
      .is('deleted_at', null)
      .single();

    if (scriptError || !script) {
      throw new Error('Script not found');
    }

    if (script.student_id !== user.id && script.teacher_id !== user.id) {
      throw new Error('Unauthorized');
    }

    // 캐시 히트: content_ko가 이미 있으면 바로 반환 (API 호출 없음)
    if (script.content_ko) {
      return new Response(
        JSON.stringify({ content_ko: script.content_ko, cached: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 구독 entitlement + rate limit 동시 체크
    const [entitlement, { data: rateLimit }] = await Promise.all([
      checkOrgEntitlement(supabaseAdmin, user.id, 'ai_feedback'),
      supabaseAdmin.rpc('check_api_rate_limit', {
        p_user_id: user.id,
        p_api_type: 'claude',
        p_max_requests: 30,
        p_window_minutes: 60,
      }),
    ]);

    if (!entitlement.allowed) {
      return new Response(
        JSON.stringify({
          error: entitlement.reason || 'FEATURE_NOT_AVAILABLE',
          plan_key: entitlement.planKey,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    if (rateLimit && !rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          remaining: rateLimit.remaining,
          reset_at: rateLimit.reset_at,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    // Claude API 호출: 영→한 번역
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: `You are a professional English-to-Korean translator for OPIc speaking test scripts.
Translate the English script naturally into Korean.
- Use natural spoken Korean (구어체), appropriate for conversation practice
- Maintain the original meaning and nuance
- Keep sentence boundaries aligned with the original
- Do NOT add explanations, notes, or anything besides the translation`,
        messages: [
          { role: 'user', content: script.content },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: TRANSLATION_SCHEMA,
          },
        },
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
    }

    const claudeResult = await claudeResponse.json();

    if (claudeResult.stop_reason !== 'end_turn') {
      throw new Error(`Claude response incomplete: ${claudeResult.stop_reason}`);
    }

    const responseText = claudeResult.content?.[0]?.text || '';
    const parsed = JSON.parse(responseText);
    const contentKo = parsed.translation;

    if (!contentKo) {
      throw new Error('Translation result is empty');
    }

    // content_ko를 DB에 캐싱 (service role로 직접 UPDATE)
    const { error: updateError } = await supabaseAdmin
      .from('scripts')
      .update({ content_ko: contentKo })
      .eq('id', scriptId);

    if (updateError) {
      // 캐싱 실패해도 번역 결과는 반환 (다음에 재시도)
      if (Deno.env.get('DENO_ENV') !== 'production') {
        console.warn('[translate-script] Cache write failed:', updateError.message);
      }
    }

    // API 사용량 기록
    const inputTokens = claudeResult.usage?.input_tokens || 0;
    const outputTokens = claudeResult.usage?.output_tokens || 0;

    await supabaseAdmin.rpc('log_api_usage', {
      p_user_id: user.id,
      p_api_type: 'claude',
      p_tokens_used: inputTokens + outputTokens,
    });

    return new Response(
      JSON.stringify({ content_ko: contentKo, cached: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
