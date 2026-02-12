# 보안 가이드라인

> RLS 정책, API 키 관리, 입력값 검증, Rate Limiting

## Supabase 데이터베이스 보안

### RLS (Row Level Security) 필수 규칙

```sql
-- ✅ 모든 테이블에 RLS 활성화
ALTER TABLE public.테이블명 ENABLE ROW LEVEL SECURITY;

-- ✅ 적절한 RLS 정책 생성
CREATE POLICY "정책명" ON public.테이블명
  FOR SELECT/INSERT/UPDATE/DELETE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ❌ 절대 금지: USING (true)
```

### VIEW 생성 규칙

```sql
-- ✅ 반드시 security_invoker 설정
CREATE VIEW public.뷰명 AS SELECT ...;
ALTER VIEW public.뷰명 SET (security_invoker = on);
```

### FUNCTION 생성 규칙

```sql
-- ✅ 반드시 search_path = '' 설정
CREATE FUNCTION public.함수명()
RETURNS ... AS $$
BEGIN
  SELECT * FROM public.테이블명;  -- public. 명시!
END;
$$ LANGUAGE plpgsql
   SET search_path = '';
```

## Storage 보안 (녹음 파일)

```sql
-- 버킷을 Private으로 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('practice-recordings', 'practice-recordings', false);

-- Storage RLS 정책
CREATE POLICY "Students can upload own recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'practice-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## API 키 관리

### 올바른 방법
- 환경 변수로 관리 (.env 파일)
- Supabase Edge Functions에서 API 호출
- .env는 .gitignore에 추가
- Supabase Secrets 사용

### 절대 금지
- 앱 코드에 API 키 하드코딩
- EXPO_PUBLIC_ 접두사로 API 키 노출
- git에 .env 파일 커밋

### 환경 변수 설정

```bash
# .env (git에 올리면 안 됨!)

# ✅ 클라이언트에서 사용 가능
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...

# ❌ 클라이언트에 노출되면 안 됨 (Edge Function에서만)
OPENAI_API_KEY=sk-xxxx...
ANTHROPIC_API_KEY=sk-ant-xxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...
```

### .gitignore 필수 항목

```bash
.env
.env.local
credentials.json
*.keystore
*.jks
*.p12
*.p8
*.mobileprovision
google-service-account.json
```

## Edge Function 보안

```toml
# supabase/config.toml
[functions.whisper-stt]
verify_jwt = true  # ✅ 반드시 true!

[functions.claude-feedback]
verify_jwt = true
```

```typescript
// CORS 설정 (와일드카드 금지!)
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-app-domain.com',
  // ❌ 'Access-Control-Allow-Origin': '*'
};
```

## 입력값 검증

```typescript
// lib/validation.ts

// 텍스트 정제 (XSS 방지)
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// 파일 업로드 검증
const ALLOWED_AUDIO_TYPES = ['audio/m4a', 'audio/mp4', 'audio/wav'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function validateAudioFile(file: { type: string; size: number }) {
  if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
    return { valid: false, message: '지원하지 않는 형식입니다.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: '파일이 너무 큽니다. (최대 50MB)' };
  }
  return { valid: true, message: '' };
}
```

## Rate Limiting

```typescript
// Edge Function에서 Rate Limiting 구현
const allowed = checkRateLimit(user.id, 30, 60 * 60 * 1000);

if (!allowed) {
  return new Response(
    JSON.stringify({ error: '요청 한도 초과. 1시간 후 다시 시도해주세요.' }),
    { status: 429 }
  );
}
```

## 보안 체크리스트

### Supabase 데이터베이스
- [ ] 모든 테이블에 RLS 활성화
- [ ] 각 테이블에 적절한 RLS 정책 생성
- [ ] USING (true) 사용하지 않음
- [ ] VIEW에 security_invoker = on 설정
- [ ] FUNCTION에 search_path = '' 설정

### Supabase Storage
- [ ] 버킷 Private 설정
- [ ] Storage RLS 정책 설정
- [ ] 파일 경로에 user_id 포함

### API 키 관리
- [ ] .env 파일 .gitignore에 추가
- [ ] API 키는 Edge Function에서만 사용
- [ ] Supabase Secrets 설정 완료

### Edge Functions
- [ ] verify_jwt = true 설정
- [ ] CORS 도메인 명시
- [ ] Rate Limiting 구현
- [ ] 입력값 검증

### 모바일 앱
- [ ] 마이크 권한 요청 로직
- [ ] expo-secure-store로 토큰 저장
- [ ] 프로덕션 빌드에서 console.log 제거

### 개인정보 보호
- [ ] 개인정보처리방침 작성
- [ ] 회원 탈퇴 기능 (데이터 삭제)
