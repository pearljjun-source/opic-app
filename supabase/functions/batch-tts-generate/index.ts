// Edge Function: batch-tts-generate
// 용도: 모든 질문에 대해 TTS 오디오를 일괄 사전 생성
// 인증: super_admin만 실행 가능 (관리자 전용)
// rate limit/구독 체크 없음 (관리 작업)
// 실행: supabase functions invoke batch-tts-generate

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { OPENAI_TTS_URL } from '../_shared/constants.ts';

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // 인증: super_admin만 허용
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

    // Service Role 클라이언트
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // super_admin 확인
    const { data: isSA } = await supabaseAdmin.rpc('is_super_admin', {
      p_user_id: user.id,
    });

    if (!isSA) {
      throw new Error('Forbidden: super_admin only');
    }

    // audio_url이 없는 모든 활성 질문 조회
    const { data: questions, error: queryError } = await supabaseAdmin
      .from('questions')
      .select('id, question_text')
      .is('audio_url', null)
      .eq('is_active', true);

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'All questions already have audio',
          processed: 0,
          failed: 0,
        }),
        {
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const results = { processed: 0, failed: 0, errors: [] as string[] };

    // 순차 처리 (OpenAI rate limit 존중)
    for (const question of questions) {
      try {
        // OpenAI TTS API 호출
        const ttsResponse = await fetch(OPENAI_TTS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: question.question_text,
            voice: 'nova',
            response_format: 'mp3',
            speed: 0.95,
          }),
        });

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          results.failed++;
          results.errors.push(`Q ${question.id}: TTS API ${ttsResponse.status} - ${errorText}`);
          continue;
        }

        // Storage 업로드
        const audioBuffer = await ttsResponse.arrayBuffer();
        const filePath = `questions/${question.id}.mp3`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('question-audio')
          .upload(filePath, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          results.failed++;
          results.errors.push(`Q ${question.id}: Upload - ${uploadError.message}`);
          continue;
        }

        // Public URL → DB 캐시
        const { data: urlData } = supabaseAdmin.storage
          .from('question-audio')
          .getPublicUrl(filePath);

        await supabaseAdmin
          .from('questions')
          .update({ audio_url: urlData.publicUrl })
          .eq('id', question.id);

        results.processed++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Q ${question.id}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Batch TTS complete: ${results.processed} generated, ${results.failed} failed`,
        total: questions.length,
        ...results,
      }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
