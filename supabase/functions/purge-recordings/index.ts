// Edge Function: purge-recordings
// 용도: 보관 기간이 지난 연습 녹음 파일 삭제 (pg_cron 매일 호출)
// 입력: 없음 (서버 간 호출)
//
// 왜:
//   개인정보보호법 제3조는 목적 달성 후 지체 없는 파기를 원칙으로 한다. 연습 녹음의
//   목적(피드백 제공)은 피드백을 받은 시점에 달성되고, 그 뒤로는 유출 시 피해만 커진다.
//   개인정보처리방침 제4조 ③이 고지한 6개월을 여기서 집행한다.
//
// 무엇을 지우고 무엇을 남기나:
//   - 지운다: Storage 의 음성 파일 (practice-recordings)
//   - 남긴다: 점수 · 재현율 · AI 피드백 · 전사 텍스트 등 학습 기록
//   학생이 잃는 것은 오래된 음성뿐이고 학습 이력은 그대로 남는다.
//
// ⚠️ Storage 파일을 지운 뒤 audio_url 을 NULL 로 만든다. 순서가 반대면 경로를 잃어
//    파일이 영영 고아로 남는다. 화면은 audio_url 이 없으면 재생 영역을 그리지 않는다.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';

/** 녹음 보관 기간(일). lib/constants.ts 의 RECORDING_RETENTION_DAYS 와 같아야 한다 */
const RETENTION_DAYS = 180;

/** 한 번에 처리할 최대 건수 — 함수 실행 시간 한도를 넘기지 않도록 */
const BATCH_SIZE = 500;

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

  try {
    // Cron 시크릿 검증 (서버 간 호출만 허용)
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret) {
      const reqSecret = req.headers.get('x-cron-secret') || '';
      if (reqSecret !== cronSecret) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // 보관 기간이 지났고 아직 파일이 남아 있는 연습.
    // 소프트 삭제된 기록도 포함한다 — 지워진 기록의 음성이 남아 있을 이유가 없다.
    const { data: expired, error: queryError } = await supabaseAdmin
      .from('practices')
      .select('id, audio_url')
      .not('audio_url', 'is', null)
      .lt('created_at', cutoff)
      .limit(BATCH_SIZE);

    if (queryError) {
      throw queryError;
    }

    if (!expired || expired.length === 0) {
      return new Response(
        JSON.stringify({ success: true, purged: 0, cutoff }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const paths = expired
      .map((p: { audio_url: string | null }) => p.audio_url)
      .filter((p: string | null): p is string => !!p);

    // 1. Storage 파일 삭제
    const { error: storageError } = await supabaseAdmin.storage
      .from('practice-recordings')
      .remove(paths);

    if (storageError) {
      // 파일을 못 지웠으면 audio_url 을 지우지 않는다. 경로를 잃으면 다음 실행에서도
      // 못 찾아 영영 남는다. 다음 회차에 다시 시도하게 둔다.
      logger.error('Storage purge failed', storageError);
      return new Response(
        JSON.stringify({ success: false, error: 'STORAGE_DELETE_FAILED', attempted: paths.length }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 2. 경로 제거 — 화면이 "녹음 없음"으로 인식한다
    const ids = expired.map((p: { id: string }) => p.id);
    const { error: updateError } = await supabaseAdmin
      .from('practices')
      .update({ audio_url: null })
      .in('id', ids);

    if (updateError) {
      // 파일은 이미 지워졌다. audio_url 이 남아 있으면 화면이 재생을 시도하다 실패한다.
      // 다음 회차에 같은 행이 다시 잡히고, Storage remove 는 없는 파일에도 성공하므로
      // 결국 정리된다.
      logger.error('audio_url clear failed (files already removed)', updateError);
    }

    logger.info('Recordings purged', { count: paths.length, cutoff });

    return new Response(
      JSON.stringify({ success: true, purged: paths.length, cutoff, hasMore: expired.length === BATCH_SIZE }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    logger.error('purge-recordings failed', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
