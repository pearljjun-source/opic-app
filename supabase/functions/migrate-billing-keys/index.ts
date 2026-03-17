// Edge Function: migrate-billing-keys
// 용도: 기존 평문 billing_key를 암호화된 값으로 마이그레이션 (일회성)
// 입력: 없음 (admin 전용, service role 인증)
// 보안: SUPABASE_SERVICE_ROLE_KEY로만 호출 가능

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';
import { encryptValue, isEncrypted } from '../_shared/crypto.ts';

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 평문 billing_key가 있는 구독 조회
    const { data: subs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, billing_key')
      .not('billing_key', 'is', null);

    if (error) throw error;

    let migrated = 0;
    let skipped = 0;

    for (const sub of subs || []) {
      if (!sub.billing_key || isEncrypted(sub.billing_key)) {
        skipped++;
        continue;
      }

      // 평문 → 암호화
      const encrypted = await encryptValue(sub.billing_key);
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({ billing_key: encrypted })
        .eq('id', sub.id);

      if (updateError) {
        logger.error(`Failed to migrate billing_key for sub ${sub.id}`, updateError);
      } else {
        migrated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, migrated, skipped, total: (subs || []).length }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('migrate-billing-keys error', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
