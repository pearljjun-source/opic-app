// Edge Function: delete-user
// 용도: 회원 탈퇴 처리 (Service Role 권한 필요)
//
// 주의: auth.admin.deleteUser() → auth.users 삭제 → public.users ON DELETE CASCADE
//       → scripts, practices, exam_sessions 등 모든 관련 데이터가 CASCADE 삭제됨
//       → soft_delete나 익명화는 CASCADE에 의해 무효화되므로 수행하지 않음
//
// 순서:
// 1. Storage 녹음 파일 삭제 (CASCADE로 커버되지 않는 유일한 리소스)
// 2. auth.users 삭제 (CASCADE로 모든 DB 데이터 삭제)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';

serve(async (req) => {
  const preFlightResponse = handleCorsPreFlight(req);
  if (preFlightResponse) return preFlightResponse;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 사용자 인증 확인
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;

    // 1. Storage 녹음 파일 삭제 (페이지네이션: 1000개씩)
    // — DB 데이터는 auth.users CASCADE로 자동 삭제되지만 Storage 파일은 별도 삭제 필요
    try {
      let hasMore = true;
      while (hasMore) {
        const { data: files } = await supabaseAdmin.storage
          .from('practice-recordings')
          .list(userId, { limit: 1000 });

        if (!files || files.length === 0) {
          hasMore = false;
          break;
        }

        const filePaths = files.map((f: { name: string }) => `${userId}/${f.name}`);
        await supabaseAdmin.storage
          .from('practice-recordings')
          .remove(filePaths);

        // 1000개 미만이면 마지막 페이지
        if (files.length < 1000) hasMore = false;
      }
    } catch (storageErr) {
      logger.error('Storage cleanup failed (non-fatal)', storageErr);
      // Storage 실패해도 계정 삭제는 계속 진행
    }

    // 2. auth.users 삭제
    // — CASCADE 체인: auth.users → public.users → scripts, practices,
    //   exam_sessions, teacher_student, invites, 등 모든 관련 데이터 삭제
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    logger.error('delete-user failed', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
