// Edge Function: claude-feedback
// 용도: Claude Haiku로 스크립트 vs 실제 답변 비교 분석
// 입력: { scriptContent: string, transcription: string }
// 출력: { score: number, reproductionRate: number, feedback: AIFeedback }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkOrgEntitlement } from '../_shared/check-subscription.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an expert OPIc (Oral Proficiency Interview - computer) speaking coach for Korean students learning English.

## Your Task
Compare a student's spoken answer (transcribed from audio) with their teacher's model script. Provide detailed, encouraging feedback that helps the student improve their OPIc performance.

## Context
- This is a practice session for OPIc exam preparation
- The student is a Korean native speaker learning English
- Focus on communicative effectiveness, not perfect word-for-word reproduction

## Analysis Framework

### 1. Script Reproduction
- Focus on KEY CONTENT and MEANING, not exact wording
- Synonyms, paraphrasing, and natural variations count as reproduced
- Note which important points from the script were missed

### 2. Creative Additions (IMPORTANT)
Evaluate phrases/expressions the student added beyond the script:
- **positive**: On-topic additions that enhance the answer (natural transitions, personal details, elaboration, self-correction) — THESE ARE GOOD and show speaking confidence
- **neutral**: Acceptable filler or rephrasing that doesn't add or detract
- **negative**: Off-topic tangents, incorrect expressions, or L1 interference that hurts clarity

### 3. Error Analysis
Identify and correct errors with awareness of common Korean L1 transfer patterns:
- Article omission (a/an/the) — Korean has no articles
- Subject omission — Korean often drops subjects
- Tense inconsistency — Korean tense system differs
- Preposition confusion (at/in/on) — different spatial concepts
- Word order (Korean SOV → English SVO)
- Pluralization — Korean doesn't mark plural on nouns
- Provide the CORRECTED version for each error

### 4. Strengths
Always find something positive, even in weak answers. Look for:
- Natural expressions, good vocabulary choices, fluency
- Successful script content delivery
- Confident additions or personal touches

## Output Format
Return ONLY valid JSON (no markdown, no backticks, no text outside JSON):

{
  "overall_score": <0-100, holistic score weighing: script coverage 60%, creative additions 15%, accuracy 15%, fluency 10%>,
  "summary": "2-3 sentence overall assessment in Korean. Be specific about what went well and what to focus on.",
  "reproduction_rate": <0-100, percentage of key script MEANING reproduced>,
  "missed_phrases": ["important phrases from script that were missed (English)"],
  "extra_phrases": ["all phrases student added beyond the script (English)"],
  "creative_additions": [
    {
      "phrase": "the added expression",
      "evaluation": "positive|neutral|negative",
      "comment": "Korean explanation — why this is good/ok/problematic"
    }
  ],
  "error_analysis": [
    {
      "type": "grammar|pronunciation|vocabulary|l1_transfer",
      "original": "what student said",
      "corrected": "corrected version",
      "explanation": "Korean explanation of the correction"
    }
  ],
  "strengths": ["what the student did well (Korean, at least 1 item)"],
  "priority_improvements": [
    {
      "area": "improvement area (Korean)",
      "tip": "specific, actionable tip (Korean)"
    }
  ],
  "encouragement": "One motivating sentence in Korean, personalized to their performance",
  "pronunciation_tips": ["specific pronunciation advice for Korean speakers (English)"],
  "grammar_issues": ["brief grammar issue descriptions (English, for compatibility)"],
  "suggestions": ["actionable improvement suggestions (Korean)"]
}

## Scoring Guidelines
- overall_score: Holistic assessment (script coverage 60% + creative additions quality 15% + grammatical accuracy 15% + overall fluency 10%)
- A student who reproduces 80% of script content AND adds good on-topic expressions could score HIGHER than 80
- Creative additions should BOOST the score when positive, not penalize
- reproduction_rate: Purely measures how much of the script's KEY MEANING was covered (0-100)
- Keep error_analysis to max 5 most impactful errors
- priority_improvements: Max 3 items, most impactful first
- strengths: At least 1, even for weak answers
- If transcription is empty or very short: overall_score < 20, encourage trying again`;

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
    const { scriptContent, transcription, questionType } = await req.json();
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

    // 구독 entitlement 체크 (비용 드는 API 호출 전)
    const entitlement = await checkOrgEntitlement(supabaseAdmin, user.id, 'ai_feedback');
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
    const questionTypeLabel = questionType
      ? `\n- Question type: ${questionType}`
      : '';

    const userMessage = `## Model Script (teacher's version)
${scriptContent}

## Student's Actual Answer (transcription from speech)
${transcription || '(No speech detected)'}
${questionTypeLabel}
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
        max_tokens: 2048,
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
        overall_score: 0,
        reproduction_rate: 0,
        missed_phrases: [],
        extra_phrases: [],
        creative_additions: [],
        error_analysis: [],
        strengths: [],
        priority_improvements: [],
        encouragement: '다시 한번 도전해보세요!',
        pronunciation_tips: [],
        grammar_issues: [],
        suggestions: ['다시 한번 연습해보세요.'],
      };
    }

    // 점수 계산: Claude의 overall_score 우선, 없으면 reproduction_rate 기반 폴백
    const reproductionRate = Math.min(100, Math.max(0, feedback.reproduction_rate || 0));
    const score = feedback.overall_score != null
      ? Math.min(100, Math.max(0, Math.round(feedback.overall_score)))
      : Math.min(100, Math.max(0, Math.round(
          reproductionRate - Math.min(15, (feedback.grammar_issues?.length || 0) * 3)
        )));

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
