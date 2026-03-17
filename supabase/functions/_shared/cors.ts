// _shared/cors.ts
// Edge Function 공통: CORS 헤더 + preflight 응답
//
// 프로덕션: ALLOWED_ORIGINS 환경변수에서 허용 도메인 읽기
// 개발: 환경변수 미설정 시 '*' 폴백

const allowedOrigins: string[] = (() => {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return [];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
})();

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';

  // 허용 도메인이 설정된 경우: 화이트리스트 체크
  if (allowedOrigins.length > 0) {
    const allowed = allowedOrigins.includes(origin);
    // 비허용 origin: CORS 헤더를 아예 포함하지 않음 (빈 문자열은 스펙 위반)
    const headers: Record<string, string> = {
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (allowed) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
  }

  // 개발 환경 폴백: 와일드카드 허용
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

export function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}
