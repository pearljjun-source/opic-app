// Edge Function: tts-generate
// 용도: OpenAI TTS API로 오디오 생성 → Storage 저장
// 입력: { questionId: string } 또는 { scriptId: string }
//   - questionId: 질문 오디오 생성 (questions.audio_url 캐싱)
//   - scriptId: 스크립트 오디오 생성 (Storage 기반 캐싱)
// 출력: { audioUrl: string, cached: boolean }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
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

    // 요청 파싱 (questionId 또는 scriptId, text는 DB에서 조회)
    const { questionId, scriptId } = await req.json();
    if (!questionId && !scriptId) {
      throw new Error('questionId or scriptId is required');
    }

    // Service Role 클라이언트
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let text: string;
    let filePath: string;
    let cachedUrl: string | null = null;

    if (scriptId) {
      // ── 스크립트 TTS ──
      // 소유권 검증: 본인 스크립트(학생) 또는 본인이 작성한 스크립트(강사)
      const { data: script, error: scriptError } = await supabaseAdmin
        .from('scripts')
        .select('content, student_id, teacher_id')
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

      text = script.content;
      filePath = `scripts/${scriptId}.mp3`;

      // Storage 기반 캐싱: 파일이 이미 존재하면 반환
      const { data: existingFile } = await supabaseAdmin.storage
        .from('question-audio')
        .list('scripts', { search: `${scriptId}.mp3` });

      if (existingFile && existingFile.length > 0) {
        const { data: urlData } = supabaseAdmin.storage
          .from('question-audio')
          .getPublicUrl(filePath);
        cachedUrl = urlData.publicUrl;
      }
    } else {
      // ── 질문 TTS ──
      // 클라이언트가 보낸 text를 절대 사용하지 않음 (텍스트 주입 방지)
      const { data: question, error: questionError } = await supabaseAdmin
        .from('questions')
        .select('question_text, audio_url')
        .eq('id', questionId)
        .single();

      if (questionError || !question) {
        throw new Error('Question not found');
      }

      if (question.audio_url) {
        cachedUrl = question.audio_url;
      }

      text = question.question_text;
      filePath = `questions/${questionId}.mp3`;
    }

    // 캐시 히트 → 바로 반환 (rate limit 소비 안 함)
    if (cachedUrl) {
      return new Response(
        JSON.stringify({ audioUrl: cachedUrl, cached: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Rate limit 사전 확인 (비용 드는 API 호출 전에 차단)
    const { data: rateLimit } = await supabaseAdmin.rpc('check_api_rate_limit', {
      p_user_id: user.id,
      p_api_type: 'tts',
      p_max_requests: 50,
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

    // OpenAI TTS API 호출 (Ava 느낌: nova 음성)
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'nova',
        response_format: 'mp3',
        speed: scriptId ? 1.0 : 0.95, // 스크립트: 일반 속도, 질문: 약간 느리게
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      throw new Error(`TTS API error: ${ttsResponse.status} - ${errorText}`);
    }

    // 오디오 데이터를 Storage에 업로드
    const audioBuffer = await ttsResponse.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from('question-audio')
      .upload(filePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload error: ${uploadError.message}`);
    }

    // Public URL 생성
    const { data: urlData } = supabaseAdmin.storage
      .from('question-audio')
      .getPublicUrl(filePath);

    const audioUrl = urlData.publicUrl;

    // 질문 TTS인 경우 questions 테이블에 audio_url 캐싱
    if (questionId) {
      await supabaseAdmin
        .from('questions')
        .update({ audio_url: audioUrl })
        .eq('id', questionId);
    }

    // API 사용량 기록
    await supabaseAdmin.rpc('log_api_usage', {
      p_user_id: user.id,
      p_api_type: 'tts',
      p_tokens_used: text.length,
    });

    return new Response(
      JSON.stringify({ audioUrl, cached: false }),
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
