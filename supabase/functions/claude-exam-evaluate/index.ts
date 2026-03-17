// Edge Function: claude-exam-evaluate
// 용도: OPIc 모의고사/레벨테스트/콤보 롤플레이 ACTFL 기반 종합 평가
// 입력: { examSessionId: string }  (ID만 — 데이터는 서버에서 DB 조회)
// 출력: ExamEvaluationReport

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkOrgEntitlement } from '../_shared/check-subscription.ts';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';

// ============================================================================
// ACTFL 채점 시스템 프롬프트
// ============================================================================

const SYSTEM_PROMPT = `You are an expert OPIc (Oral Proficiency Interview - computer) evaluator certified in ACTFL proficiency guidelines.

## Your Task
Evaluate a student's OPIc exam responses using the ACTFL 4-dimension framework. You will receive ALL question-answer pairs from one exam session and provide both per-question and overall assessment.

## ACTFL 4-Dimension Scoring (0-100 each)

### 1. Function/Task (과제 수행)
How well the student performs the communicative tasks expected at their level:
- 0-15 (NL): Isolated words, memorized phrases
- 16-30 (NM): Short phrases, basic greeting/leave-taking
- 31-40 (NH): Sentences attempted, some succeed
- 41-50 (IL): Creates sentences, handles simple transactions
- 51-60 (IM1): Connects sentences with basic conjunctions (and, but, so)
- 61-70 (IM2): Diverse connectors, some time markers, expanding range
- 71-80 (IM3): Consistent tense usage, stable pronunciation, self-corrects
- 81-90 (IH): Paragraph-level speech, can narrate and describe
- 91-100 (AL): Extended discourse, can argue and hypothesize

### 2. Accuracy (정확성)
Grammar, vocabulary range, pronunciation clarity:
- Grammar: Subject-verb agreement, tense consistency, article usage
- Vocabulary: Range and precision of word choice
- Pronunciation: Intelligibility to native speakers
- Self-correction: Ability to notice and fix own errors

### 3. Content/Context (내용/맥락)
Relevance, depth, and elaboration:
- Topic relevance: Does the answer address the question?
- Depth: Surface-level vs detailed, specific response
- Elaboration: Examples, reasons, descriptions
- Range: Variety of topics handled successfully

### 4. Text Type (텍스트 유형)
Discourse organization and complexity:
- 0-20: Words, fragments
- 21-40: Phrases, incomplete sentences
- 41-55: Simple sentences
- 56-70: Connected sentences (strings of sentences)
- 71-85: Paragraphs (organized discourse with topic sentences)
- 86-100: Extended discourse (multiple paragraphs, cohesive argument)

## OPIc Grade Mapping
Map overall performance to OPIc grades:
- NL (Novice Low): overall 0-15
- NM (Novice Mid): overall 16-30
- NH (Novice High): overall 31-44
- IL (Intermediate Low): overall 45-54
- IM1 (Intermediate Mid 1): overall 55-63
- IM2 (Intermediate Mid 2): overall 64-71
- IM3 (Intermediate Mid 3): overall 72-79
- IH (Intermediate High): overall 80-89
- AL (Advanced Low): overall 90-100

## Output Format
Fill in the following JSON structure:

{
  "estimated_grade": "IM2",
  "overall_score": 67,
  "score_function": 65,
  "score_accuracy": 60,
  "score_content": 70,
  "score_text_type": 68,
  "summary_ko": "전반적인 평가 요약 (한국어 3-5문장)",
  "grade_justification": "Why this grade was assigned (Korean, 2-3 sentences)",
  "key_strengths": ["강점1", "강점2", "강점3"],
  "priority_improvements": [
    { "area": "개선 영역", "tip": "구체적 학습 팁" }
  ],
  "study_plan": "Recommended next steps for improvement (Korean, 3-5 sentences)",
  "per_question": [
    {
      "response_id": "uuid of the exam_response",
      "score": 65,
      "score_function": 63,
      "score_accuracy": 58,
      "score_content": 70,
      "score_text_type": 65,
      "level_indicator": "IM2",
      "strengths": ["강점 (Korean)"],
      "improvements": ["개선점 (Korean)"],
      "error_analysis": [
        {
          "type": "grammar|pronunciation|vocabulary|l1_transfer",
          "original": "what student said",
          "corrected": "corrected version",
          "explanation": "Korean explanation"
        }
      ]
    }
  ]
}

## Important Notes
- Evaluate each response individually but consider overall consistency for the final grade
- Self-introduction (Q1) may be marked as is_scored=false — still include in per_question but don't weigh in overall
- Empty/very short transcriptions (< 5 words): score 0-10, indicate "skipped or no meaningful speech"
- L1 transfer errors (Korean → English) are expected — note them but don't over-penalize
- Combo roleplay questions (3 consecutive): evaluate as a set, noting progression
- priority_improvements: max 3, most impactful first
- key_strengths: at least 2, find positives even in weak performances
- All feedback text should be in Korean except error_analysis original/corrected`;

// ============================================================================
// Structured Outputs JSON 스키마 — API가 스키마 준수를 강제하여 파싱 실패 방지
// ============================================================================

const EXAM_SCHEMA = {
  type: 'object',
  properties: {
    estimated_grade: { type: 'string', enum: ['NL', 'NM', 'NH', 'IL', 'IM1', 'IM2', 'IM3', 'IH', 'AL'] },
    overall_score: { type: 'integer', description: '0-100' },
    score_function: { type: 'integer', description: '0-100, Function/Task dimension' },
    score_accuracy: { type: 'integer', description: '0-100, Accuracy dimension' },
    score_content: { type: 'integer', description: '0-100, Content/Context dimension' },
    score_text_type: { type: 'integer', description: '0-100, Text Type dimension' },
    summary_ko: { type: 'string', description: 'Overall assessment in Korean, 3-5 sentences' },
    grade_justification: { type: 'string', description: 'Why this grade was assigned, Korean, 2-3 sentences' },
    key_strengths: { type: 'array', items: { type: 'string' }, description: 'Korean, at least 2 items' },
    priority_improvements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string', description: 'Improvement area (Korean)' },
          tip: { type: 'string', description: 'Specific study tip (Korean)' },
        },
        required: ['area', 'tip'],
        additionalProperties: false,
      },
    },
    study_plan: { type: 'string', description: 'Recommended next steps, Korean, 3-5 sentences' },
    per_question: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          response_id: { type: 'string', description: 'UUID of the exam_response' },
          score: { type: 'integer', description: '0-100' },
          score_function: { type: 'integer', description: '0-100' },
          score_accuracy: { type: 'integer', description: '0-100' },
          score_content: { type: 'integer', description: '0-100' },
          score_text_type: { type: 'integer', description: '0-100' },
          level_indicator: { type: 'string', enum: ['NL', 'NM', 'NH', 'IL', 'IM1', 'IM2', 'IM3', 'IH', 'AL'] },
          strengths: { type: 'array', items: { type: 'string' }, description: 'Korean' },
          improvements: { type: 'array', items: { type: 'string' }, description: 'Korean' },
          error_analysis: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['grammar', 'pronunciation', 'vocabulary', 'l1_transfer'] },
                original: { type: 'string', description: 'What student said' },
                corrected: { type: 'string', description: 'Corrected version' },
                explanation: { type: 'string', description: 'Korean explanation' },
              },
              required: ['type', 'original', 'corrected', 'explanation'],
              additionalProperties: false,
            },
          },
        },
        required: ['response_id', 'score', 'score_function', 'score_accuracy', 'score_content', 'score_text_type', 'level_indicator', 'strengths', 'improvements', 'error_analysis'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'estimated_grade', 'overall_score', 'score_function', 'score_accuracy',
    'score_content', 'score_text_type', 'summary_ko', 'grade_justification',
    'key_strengths', 'priority_improvements', 'study_plan', 'per_question',
  ],
  additionalProperties: false,
};

// ============================================================================
// Helper: 점수 범위 강제
// ============================================================================

function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : 0;
  return Math.min(100, Math.max(0, Math.round(num)));
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    // 1. 인증
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

    // 2. 요청 파싱 (ID만 수신)
    const { examSessionId } = await req.json();
    if (!examSessionId) {
      throw new Error('examSessionId is required');
    }

    // 3. Service Role 클라이언트 (DB 조회 + 점수 기록용)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. 세션 조회 + 인가 (student_id = user.id 검증)
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('exam_sessions')
      .select('*')
      .eq('id', examSessionId)
      .is('deleted_at', null)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'EXAM_SESSION_NOT_FOUND' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // 인가: 본인 세션만 평가 가능
    if (session.student_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // 이미 처리 중/완료인 경우 중복 방지
    if (session.processing_status === 'processing') {
      return new Response(
        JSON.stringify({ error: 'EXAM_ALREADY_PROCESSING' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 409 }
      );
    }
    if (session.processing_status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'EXAM_ALREADY_COMPLETED' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // 5. 구독 + rate limit 병렬 체크
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
        JSON.stringify({ error: entitlement.reason || 'FEATURE_NOT_AVAILABLE', plan_key: entitlement.planKey }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (rateLimit && !rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', remaining: rateLimit.remaining, reset_at: rateLimit.reset_at }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // 6. processing_status = 'processing' (CAS: WHERE processing_status = 'pending')
    const { data: updateResult } = await supabaseAdmin
      .from('exam_sessions')
      .update({ processing_status: 'processing' })
      .eq('id', examSessionId)
      .eq('processing_status', 'pending')
      .select('id')
      .single();

    if (!updateResult) {
      return new Response(
        JSON.stringify({ error: 'EXAM_ALREADY_PROCESSING' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // 7. 모든 응답 조회
    const { data: responses, error: responsesError } = await supabaseAdmin
      .from('exam_responses')
      .select('id, question_order, question_id, roleplay_question_id, transcription, is_scored, combo_number, combo_position')
      .eq('exam_session_id', examSessionId)
      .order('question_order', { ascending: true });

    if (responsesError || !responses || responses.length === 0) {
      await supabaseAdmin
        .from('exam_sessions')
        .update({ processing_status: 'failed' })
        .eq('id', examSessionId);
      return new Response(
        JSON.stringify({ error: 'EXAM_NO_RECORDINGS' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 8. 질문 텍스트 조회 (questions + roleplay_scenario_questions)
    const questionIds = responses.filter(r => r.question_id).map(r => r.question_id);
    const roleplayQuestionIds = responses.filter(r => r.roleplay_question_id).map(r => r.roleplay_question_id);

    const [questionsResult, roleplayQuestionsResult] = await Promise.all([
      questionIds.length > 0
        ? supabaseAdmin.from('questions').select('id, question_text, question_type').in('id', questionIds)
        : { data: [] },
      roleplayQuestionIds.length > 0
        ? supabaseAdmin.from('roleplay_scenario_questions').select('id, question_text, roleplay_type').in('id', roleplayQuestionIds)
        : { data: [] },
    ]);

    const questionMap = new Map<string, { text: string; type: string }>();
    for (const q of (questionsResult.data || [])) {
      questionMap.set(q.id, { text: q.question_text, type: q.question_type });
    }
    for (const rq of (roleplayQuestionsResult.data || [])) {
      questionMap.set(rq.id, { text: rq.question_text, type: rq.roleplay_type });
    }

    // 9. Claude 프롬프트 구성
    const examTypeLabel = session.exam_type === 'mock_exam' ? 'Full Mock Exam'
      : session.exam_type === 'combo_roleplay' ? 'Combo Roleplay Practice'
      : 'Level Test';

    let questionsText = `## Exam Type: ${examTypeLabel}\n`;
    if (session.self_assessment_level) {
      questionsText += `## Self-Assessment Level: ${session.self_assessment_level}/6\n`;
    }
    questionsText += `## Total Questions: ${responses.length}\n\n`;

    for (const resp of responses) {
      const qId = resp.question_id || resp.roleplay_question_id;
      const qInfo = qId ? questionMap.get(qId) : null;
      const qText = qInfo?.text || '(Question text unavailable)';
      const qType = qInfo?.type || 'unknown';

      questionsText += `### Q${resp.question_order} [${qType}]${resp.is_scored === false ? ' (NOT SCORED - self intro)' : ''}`;
      if (resp.combo_number) {
        questionsText += ` [Combo ${resp.combo_number}, Position ${resp.combo_position}]`;
      }
      questionsText += `\n**Question:** ${qText}\n`;
      questionsText += `**Student's Answer:** ${resp.transcription || '(No speech / skipped)'}\n`;
      questionsText += `**Response ID:** ${resp.id}\n\n`;
    }

    const userMessage = questionsText + 'Please evaluate all responses using the ACTFL framework.';

    // 10. Claude API 호출
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: EXAM_SCHEMA,
          },
        },
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      await supabaseAdmin
        .from('exam_sessions')
        .update({ processing_status: 'failed' })
        .eq('id', examSessionId);
      throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
    }

    const claudeResult = await claudeResponse.json();

    // 11. Structured Outputs: stop_reason 검증
    if (claudeResult.stop_reason !== 'end_turn') {
      await supabaseAdmin
        .from('exam_sessions')
        .update({ processing_status: 'failed' })
        .eq('id', examSessionId);
      throw new Error(`Claude response incomplete: ${claudeResult.stop_reason}`);
    }

    const responseText = claudeResult.content?.[0]?.text || '';
    const evaluation = JSON.parse(responseText);

    // 12. 점수 안전 클램핑
    const overallScore = clampScore(evaluation.overall_score);
    const scoreFunction = clampScore(evaluation.score_function);
    const scoreAccuracy = clampScore(evaluation.score_accuracy);
    const scoreContent = clampScore(evaluation.score_content);
    const scoreTextType = clampScore(evaluation.score_text_type);

    const validGrades = ['NL', 'NM', 'NH', 'IL', 'IM1', 'IM2', 'IM3', 'IH', 'AL'];
    const estimatedGrade = validGrades.includes(evaluation.estimated_grade)
      ? evaluation.estimated_grade
      : 'IM1';

    // 13. 개별 응답 점수 업데이트
    const perQuestion = Array.isArray(evaluation.per_question) ? evaluation.per_question : [];
    for (const pq of perQuestion) {
      if (!pq.response_id) continue;
      await supabaseAdmin
        .from('exam_responses')
        .update({
          score: clampScore(pq.score),
          feedback: {
            score_function: clampScore(pq.score_function),
            score_accuracy: clampScore(pq.score_accuracy),
            score_content: clampScore(pq.score_content),
            score_text_type: clampScore(pq.score_text_type),
            level_indicator: validGrades.includes(pq.level_indicator) ? pq.level_indicator : null,
            strengths: Array.isArray(pq.strengths) ? pq.strengths : [],
            improvements: Array.isArray(pq.improvements) ? pq.improvements : [],
            error_analysis: Array.isArray(pq.error_analysis) ? pq.error_analysis : [],
          },
          processing_status: 'completed',
        })
        .eq('id', pq.response_id)
        .eq('exam_session_id', examSessionId);
    }

    // 13b. per_question에 포함되지 않은 응답 'skipped' 처리
    const evaluatedIds = new Set(perQuestion.map((pq: any) => pq.response_id).filter(Boolean));
    const unevaluatedIds = responses
      .map(r => r.id)
      .filter(id => !evaluatedIds.has(id));

    if (unevaluatedIds.length > 0) {
      for (const respId of unevaluatedIds) {
        await supabaseAdmin
          .from('exam_responses')
          .update({ processing_status: 'skipped' })
          .eq('id', respId)
          .eq('exam_session_id', examSessionId);
      }
    }

    // 14. 세션 종합 점수 업데이트
    const evaluationReport = {
      estimated_grade: estimatedGrade,
      overall_score: overallScore,
      score_function: scoreFunction,
      score_accuracy: scoreAccuracy,
      score_content: scoreContent,
      score_text_type: scoreTextType,
      summary_ko: evaluation.summary_ko || '',
      grade_justification: evaluation.grade_justification || '',
      key_strengths: Array.isArray(evaluation.key_strengths) ? evaluation.key_strengths : [],
      priority_improvements: Array.isArray(evaluation.priority_improvements) ? evaluation.priority_improvements : [],
      study_plan: evaluation.study_plan || '',
      per_question: perQuestion,
    };

    await supabaseAdmin
      .from('exam_sessions')
      .update({
        estimated_grade: estimatedGrade,
        score_function: scoreFunction,
        score_accuracy: scoreAccuracy,
        score_content: scoreContent,
        score_text_type: scoreTextType,
        overall_score: overallScore,
        evaluation_report: evaluationReport,
        processing_status: 'completed',
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', examSessionId);

    // 15. API 사용량 기록
    const inputTokens = claudeResult.usage?.input_tokens || 0;
    const outputTokens = claudeResult.usage?.output_tokens || 0;
    await supabaseAdmin.rpc('log_api_usage', {
      p_user_id: user.id,
      p_api_type: 'claude',
      p_tokens_used: inputTokens + outputTokens,
    });

    // 16. 응답
    return new Response(
      JSON.stringify(evaluationReport),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
