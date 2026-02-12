// Edge Function: claude-feedback
// 용도: Claude Haiku로 스크립트 vs 실제 답변 비교 분석
// 입력: { scriptContent: string, transcription: string }
// 출력: { score: number, reproductionRate: number, feedback: AIFeedback }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an OPIc (Oral Proficiency Interview - computer) exam coach for Korean students learning English.

Your task is to compare a student's actual spoken answer (transcription) with the model script their teacher prepared.

Analyze and provide feedback in the following JSON format ONLY (no other text):

{
  "summary": "Brief overall assessment in Korean (2-3 sentences)",
  "reproduction_rate": <number 0-100>,
  "missed_phrases": ["key phrases from the script that the student missed"],
  "extra_phrases": ["phrases the student added that weren't in the script"],
  "pronunciation_tips": ["specific pronunciation advice based on common Korean-English patterns"],
  "grammar_issues": ["grammar mistakes found in the transcription"],
  "suggestions": ["actionable improvement suggestions in Korean"]
}

Guidelines:
- reproduction_rate: percentage of key content from the script that appeared in the answer
- Focus on meaning, not exact word matching
- Consider synonyms and paraphrasing as reproduced
- Be encouraging but honest
- Write summary and suggestions in Korean for the student
- Write missed_phrases, extra_phrases, pronunciation_tips, grammar_issues in English
- If the transcription is empty or too short, give a low score and encourage the student to try again`;

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
    const { scriptContent, transcription } = await req.json();
    if (!scriptContent) {
      throw new Error('scriptContent is required');
    }
    if (transcription === undefined || transcription === null) {
      throw new Error('transcription is required');
    }

    // Service Role 클라이언트 (rate limit 확인용)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Rate limit 사전 확인 (비용 드는 API 호출 전에 차단)
    const { data: rateLimit } = await supabaseAdmin.rpc('check_api_rate_limit', {
      p_user_id: user.id,
      p_api_type: 'claude',
      p_max_requests: 30,
      p_window_minutes: 60,
    });

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

    // Claude API 호출
    const userMessage = `## Model Script (teacher's version)
${scriptContent}

## Student's Actual Answer (transcription from speech)
${transcription || '(No speech detected)'}

Please analyze and compare these two texts.`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
    }

    const claudeResult = await claudeResponse.json();
    const responseText = claudeResult.content?.[0]?.text || '';

    // JSON 파싱 (Claude가 ```json ... ``` 으로 감쌀 수 있음)
    let feedback;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      feedback = JSON.parse(jsonMatch[0]);
    } catch {
      // 파싱 실패 시 기본 피드백 반환
      feedback = {
        summary: '분석 결과를 처리하는 중 오류가 발생했습니다. 다시 시도해주세요.',
        reproduction_rate: 0,
        missed_phrases: [],
        extra_phrases: [],
        pronunciation_tips: [],
        grammar_issues: [],
        suggestions: ['다시 한번 연습해보세요.'],
      };
    }

    // 점수 계산: reproduction_rate 기반 + 문법/발음 감점
    const reproductionRate = Math.min(100, Math.max(0, feedback.reproduction_rate || 0));
    const grammarPenalty = Math.min(15, (feedback.grammar_issues?.length || 0) * 3);
    const score = Math.min(100, Math.max(0, Math.round(reproductionRate - grammarPenalty)));

    // API 사용량 기록 (supabaseAdmin은 위에서 이미 생성됨)
    const inputTokens = claudeResult.usage?.input_tokens || 0;
    const outputTokens = claudeResult.usage?.output_tokens || 0;

    await supabaseAdmin.rpc('log_api_usage', {
      p_user_id: user.id,
      p_api_type: 'claude',
      p_tokens_used: inputTokens + outputTokens,
    });

    return new Response(
      JSON.stringify({
        score,
        reproductionRate,
        feedback,
      }),
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
