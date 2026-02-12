// Edge Function: whisper-stt
// 용도: OpenAI Whisper API를 사용한 음성→텍스트 변환 (STT)
// 입력: { audioPath: string } (Storage 경로)
// 출력: { transcription: string }

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

    // 요청 파싱 + 소유권 검증
    const { audioPath } = await req.json();
    if (!audioPath) {
      throw new Error('audioPath is required');
    }

    // 소유권 검증: audioPath가 반드시 본인 ID로 시작해야 함
    // Storage 구조: {user_id}/{filename}
    if (!audioPath.startsWith(`${user.id}/`) || audioPath.includes('..')) {
      throw new Error('Unauthorized: invalid audio path');
    }

    // Service Role 클라이언트
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Rate limit 사전 확인 (비용 드는 API 호출 전에 차단)
    const { data: rateLimit } = await supabaseAdmin.rpc('check_api_rate_limit', {
      p_user_id: user.id,
      p_api_type: 'whisper',
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

    // Storage에서 오디오 파일 다운로드
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('practice-recordings')
      .download(audioPath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download audio: ${downloadError?.message || 'File not found'}`);
    }

    // OpenAI Whisper API 호출
    const formData = new FormData();
    formData.append('file', fileData, 'audio.m4a');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // OPIc은 영어 시험

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      throw new Error(`Whisper API error: ${whisperResponse.status} - ${errorText}`);
    }

    const whisperResult = await whisperResponse.json();
    const transcription = whisperResult.text || '';

    // API 사용량 기록
    await supabaseAdmin.rpc('log_api_usage', {
      p_user_id: user.id,
      p_api_type: 'whisper',
      p_tokens_used: Math.ceil(transcription.length / 4),
    });

    return new Response(
      JSON.stringify({ transcription }),
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
