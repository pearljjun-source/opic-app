# Speaky 배포 가이드

> 환경 구성, EAS Build, 버전 관리, 앱스토어 배포

## 환경 구성

| 환경 | 용도 | Supabase 프로젝트 |
|------|------|------------------|
| development | 로컬 개발 | nnneyjvcbevwmsvvundr |
| preview | 내부 APK 테스트 | 동일 |
| production | 실제 서비스 | 동일 |

> 현재 소규모(학생 10명) 운영이므로 단일 Supabase 프로젝트 사용.
> 사용자 규모 증가 시 프로덕션 전용 프로젝트 분리 검토.

---

## 환경 변수

```bash
# .env (단일 환경)
EXPO_PUBLIC_SUPABASE_URL=https://nnneyjvcbevwmsvvundr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

> API 키(OPENAI, ANTHROPIC)는 앱 `.env`가 아닌 `supabase secrets set`으로 관리.

---

## EAS Build 설정

실제 설정 파일: `eas.json`

| 프로필 | 용도 | 빌드 타입 |
|--------|------|-----------|
| development | 개발 클라이언트 | internal |
| preview | 내부 테스트 | APK |
| production | 스토어 제출 | app-bundle |

- `autoIncrement`: 프로덕션 빌드마다 versionCode 자동 증가
- `serviceAccountKeyPath`: Google Play 자동 제출용 서비스 계정 키
- `track: internal`: 내부 테스트 트랙에 먼저 배포

---

## EAS 빌드 보안 주의사항

### Credentials 관리
- `eas credentials` 실행 시 "Let EAS manage my credentials" 선택
- EAS 클라우드에 안전하게 저장됨

### 절대 커밋 금지 파일들
- `credentials.json` (로컬 생성 시 즉시 삭제!)
- `*.keystore`, `*.jks` (Android 서명 키)
- `*.p12`, `*.p8` (iOS 인증서/Push 키)
- `*.mobileprovision` (iOS 프로비저닝)
- `google-service-account.json` (Play Store 서비스 계정)

### 만약 실수로 커밋했다면?
1. 즉시 새 키 생성 (기존 키 폐기)
2. git history에서 제거 (git filter-branch 또는 BFG)

> git history에 남아있으면 여전히 노출됨!

---

## 버전 관리

```json
// app.json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1
    }
  }
}
```

- `version`: 사용자에게 표시되는 버전 (수동 관리)
- `versionCode`: Play Store 내부 버전 (`autoIncrement`로 자동 증가)

---

## 앱스토어 메타데이터

### 기본 정보
- 앱 이름: **Speaky**
- 패키지명: `com.opic.app`
- 카테고리: 교육
- 콘텐츠 등급: 전체이용가

### 설명
- 짧은 설명 (80자): OPIc 시험 대비 스크립트 기반 영어 말하기 연습 앱
- 긴 설명 (4000자): 기능 상세 설명

### 그래픽 자산
- 앱 아이콘: 1024x1024px (PNG)
- 기능 그래픽: 1024x500px (Google Play)
- 스크린샷: 최소 2장 (1080x1920px 이상)

### 권한 설명
- 마이크: "영어 말하기 연습 녹음을 위해 필요합니다"
- 알림: "새 스크립트, 피드백 알림을 받기 위해 필요합니다"

---

## 배포 전 체크리스트

### 앱 기본
- [x] 앱 아이콘 준비 (speaky-icon.png)
- [x] 스플래시 스크린 준비
- [x] 앱 이름 확정: Speaky
- [x] 패키지명 확정: com.opic.app

### EAS & 빌드
- [ ] `eas init` 실행 (projectId 설정)
- [ ] 프리뷰 APK 빌드 및 실기기 테스트
- [ ] 프로덕션 빌드 생성

### Supabase
- [ ] Edge Functions 배포 (5개)
- [ ] API 키 설정 (`supabase secrets set`)
- [ ] 테스트 데이터 정리

### 스토어 등록 (Google Play)
- [ ] 앱 생성 (패키지명: com.opic.app)
- [ ] 서비스 계정 키 생성 (google-service-account.json)
- [ ] 앱 설명 작성 (한국어)
- [ ] 스크린샷 준비 (최소 2장)
- [ ] 기능 그래픽 준비 (1024x500px)
- [ ] 콘텐츠 등급 설문 완료
- [ ] 개인정보처리방침 URL 등록

### 웹 배포
- [x] 웹 빌드 완료 (`dist/` 폴더)
- [ ] 정적 호스팅 배포 (Vercel/Netlify)

### 보안
- [x] API 키 환경변수 분리 (supabase secrets)
- [x] RLS 정책 적용 완료
- [x] console.log/error 정리 완료
- [x] 자동화 테스트 통과 (336개)

---

## Phase 2~4 마이그레이션 안전 적용 절차

학생들이 앱을 사용하는 동안 새 기능 개발 시:

```bash
# 1. 로컬에서 마이그레이션 테스트
supabase start
supabase db reset    # 로컬 DB에 모든 마이그레이션 적용

# 2. 새 마이그레이션 작성 및 로컬 테스트
# supabase/migrations/016_xxx.sql 작성
supabase db reset    # 새 마이그레이션 포함 전체 재적용

# 3. 로컬 테스트 통과 후 프로덕션에 적용
supabase db push     # 프로덕션 DB에 새 마이그레이션만 적용

# 4. Edge Functions 변경 시
supabase functions deploy [function-name]
```

> **주의**: `supabase db reset`은 로컬에서만 사용! 프로덕션에서는 `supabase db push`로 증분 적용.

---

## 자주 사용하는 명령어

```bash
# 개발
npx expo start                    # 개발 서버
npx expo start --android          # Android
npx expo start --web              # Web

# 빌드
eas build --profile preview --platform android    # 테스트 APK
eas build --profile production --platform android # 프로덕션 빌드
eas submit --platform android                     # Play Store 제출

# 웹 배포
npx expo export --platform web    # dist/ 폴더 생성

# Supabase
supabase link --project-ref nnneyjvcbevwmsvvundr
supabase functions deploy whisper-stt
supabase functions deploy tts-generate
supabase functions deploy claude-feedback
supabase functions deploy deliver-notification
supabase functions deploy delete-user
supabase secrets set OPENAI_API_KEY=sk-xxx
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
supabase db push                  # 마이그레이션 적용

# 테스트
npm test
npm run test:coverage
```
