# Speaky — OPIc 학습 SaaS 플랫폼

> **문서 버전**: v5.1
> **최종 수정일**: 2026-08-28
> **작성자**: Jin + Claude AI

---

## 상위 가이드라인 (필독)

> **이 문서보다 먼저 읽을 것: [`../JIN_APP_GUIDELINES.md`](../JIN_APP_GUIDELINES.md) (v2.3)**
>
> 모든 앱에 공통 적용되는 원칙 문서. **PART A(공통 원칙 A1~A22) 전체**와
> **PART B1(Expo / React Native) 부록**을 이 프로젝트의 모든 작업에 적용한다.
> 아래 CLAUDE.md는 그 원칙을 이 앱에 구체화한 문서이며, 충돌 시 가이드라인이 우선한다.

### 이 프로젝트에 이미 반영된 원칙

| 원칙 | 반영 위치 |
|------|----------|
| A1 문제 해결 원칙 + 교체 완결성 | 아래 "문제 해결 원칙" |
| A3 보안 (서버 인가, RLS, TOCTOU/CAS) | 아래 "보안 핵심 원칙" |
| A6 멱등성 | 아래 "TOSS Payments 결제 아키텍처" |
| A11 서비스 레이어 패턴 | `services/` 전체 |
| A14 결제 시스템 | 아래 "TOSS Payments 결제 아키텍처" |
| A18 마이그레이션 관리 | 아래 "마이그레이션 이력" |

### ⚠️ 아직 지켜지지 않은 원칙 (작업 시 확인할 것)

| 원칙 | 현재 상태 | 조치 |
|------|----------|------|
| ~~A13 `void fn()`~~ | ✅ 해당 없음으로 확인 (2026-09-02). `services/scripts.ts`의 fire-and-forget 호출은 **클라이언트**에서 돌고, 실패해도 복구 경로가 있다 — `translation-practice.tsx`는 `content_ko`가 없으면 그 자리에서 번역하고, `shadowing.tsx`는 TTS를 그때 생성한다. 즉 **사전 예열(pre-warm)이지 유일한 경로가 아니다.** A13이 경고하는 상황은 서버리스에서 응답 직후 함수가 얼어 작업이 사라지는 경우다 | 유지. Edge Function에서 같은 패턴을 쓸 때만 A13 적용 |
| **A15 테스트 전략** | 865개 중 ~205개가 소스 파일 문자열 매칭(`readFileSync` + `toContain`). `services` 커버리지 31.8%, `practices.ts` 1.81%, `topics.ts` 0%. 컴포넌트 테스트 0개, E2E 0개 | 아래 "테스트 로드맵" |
| **A21 접근성 최소선** | `accessibilityLabel` 사용 0건. 라벨 연결·색 의존·대비 4.5:1·터치 24px 미검증 | 신규/수정 화면부터 적용 |
| **A8 시간대 처리** | 문서화 없음 | 통계·스트릭 집계 기준 시간대 명문화 필요 |
| **A9 개인정보 / PII** | 문서화 없음 (음성 녹음·STT 텍스트를 다루는 앱) | 보관 기간·삭제 경로 명문화 필요 |
| **A19 배포 전 체크리스트** | 문서화 없음 | 배포 전 가이드라인 A19 그대로 사용 |

---

## 테스트 로드맵

> 현재 상태: 실행 검증(`import` 후 함수 호출) 9개 파일 / 텍스트 매칭 6개 파일 / 혼합 4개 파일.
> **문자열 매칭 테스트는 리팩터링에는 깨지고 실제 버그는 못 잡는다** — 실행 테스트로 교체 대상.

| 단계 | 내용 | 근거 |
|------|------|------|
| 1 | 텍스트 매칭 테스트 → mock Supabase 기반 **서비스 실행 테스트**로 교체 | ✅ 완료 — 6개 파일, 텍스트 단언 약 375개 제거 |
| 1.5 | **스키마 드리프트 검사** (`npm run check:schema`) | ✅ 완료 — 아래 참조 |
| 2 | 커버리지 0% 서비스 | ✅ `practices.ts` 47.8% · `topics.ts` 93.2% · `classes.ts` 88.9% · `students.ts` 90.9%. 남은 0%: `organizations` `admin` `notifications` `landing` `expressions` |
| 3 | `@testing-library/react-native` 도입 → 상태 전이 화면부터 컴포넌트 테스트 | 🔄 `exam/orientation.tsx` · `exam/session.tsx`(자동 모드) 완료. 데드락·TTS 무한루프를 되살리면 각각 2개가 실패한다 |
| 4 | Maestro E2E — 로그인 → 토픽 → 스크립트 → 녹음 1개 플로우 | 회귀 안전망 |

### 스키마 드리프트 검사

> **마이그레이션 파일에 있는 객체가 실제 DB에도 있는지 대조한다.**
> `supabase_migrations.schema_migrations` 이력은 057~077 구간이 실제 스키마와
> 어긋나 있어 신뢰할 수 없다 — 그래서 이력이 아니라 **객체의 실존**을 본다.

```bash
npm run check:schema -- --dry              # 토큰 없이 파싱 결과만
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run check:schema
```

- 스크립트: [scripts/schema-drift.js](scripts/schema-drift.js) — 테이블 · 함수 · ENUM을
  파일 순서대로 재생(replay)해 DROP된 것을 제외한 "최종 기대 목록"을 만든다.
- 종료 코드: `0` 일치 / `1` 미적용 객체 있음 / `2` 토큰 없음·조회 실패 → CI에서 그대로 사용.
- ⚠️ **토큰은 저장소에 넣지 않는다.** CI 시크릿이나 셸 환경변수로만 넘긴다.
- DB에만 있고 파일에 없는 객체는 실패로 보지 않는다(수동 생성 허용).
- 한계: **객체의 존재만** 본다. 059처럼 "객체는 있는데 내용이 옛 버전"은 못 잡는다.

**CI**: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- `test` 잡(타입체크 + 테스트) — 모든 push / PR
- `schema-drift` 잡 — **매일 09:00 KST + 수동 실행**. PR에서는 돌리지 않는다:
  새 마이그레이션을 추가하는 PR은 아직 DB에 없는 게 정상이라 전부 빨간불이 된다.
  이 검사가 잡으려는 건 "머지·배포됐는데 DB에는 적용 안 된" 상태다.
- 필요한 시크릿: `SUPABASE_ACCESS_TOKEN` (선택: 변수 `SUPABASE_PROJECT_REF`)

### ⚠️ 마이그레이션 재적용 시 확인할 것

`CREATE OR REPLACE` 로 만든 함수는 **나중 마이그레이션이 다시 정의했을 수 있다.**
옛 파일을 통째로 재실행하면 최신 정의가 조용히 덮어써진다 — 에러도 나지 않는다.

- 실제 사례: `create_trial_subscription` 은 059에서 생성되고 **073에서 30일로 재작성**됐다.
  059를 재실행했다면 트라이얼이 14일로 회귀했을 것이다.
- 재적용 전 확인: `scripts/schema-drift.js` 의 `origin` 이 그 객체를 **어느 파일로** 가리키는지
  본다. 자기 파일이 아니면 그 블록은 빼고 적용한다.

### 컴포넌트 테스트 작성 시

- `__tests__/setup.ts` 가 AsyncStorage 를 모킹한다. 화면을 그리면 `useTheme` 이 걸린다.
- 카운트다운처럼 **매 초 새 타이머를 거는** 화면은 `advanceTimersByTime(3000)` 한 번으로는
  안 된다. effect 가 다음 타이머를 걸 틈이 없다. 1초씩 나눠 `act()` 로 감싼다.
- 훅을 모킹할 때 상태 값을 바꿔 재렌더링하려면 **초기값을 다르게** 두어야 한다.
  같은 값으로 바꾸면 의존성이 변하지 않아 effect 가 재실행되지 않는다.
- **비동기 시작을 "결과"로 검증하지 말 것.** `recorder.record` 가 안 불렸다는 것은
  가드가 막았다는 뜻도 되고, 아직 await 중이라는 뜻도 된다. 두 경우를 구분하려면
  가드 바로 안쪽(`requireConsent`)이 불렸는지를 본다. 실제로 이 차이 때문에
  데드락 테스트가 잘못된 이유로 통과했고, 돌연변이를 넣어보고서야 알았다.

**테스트 작성 규칙** (가이드라인 A15):
- 테스트 데이터는 `zz-` 접두사로 직접 만들고 끝나면 지운다. 실제 데이터를 잡아 쓰지 않는다.
- 메일·푸시·결제·웹훅 등 **바깥으로 나가는 부작용은 배포본에서 시험하지 않는다.**
- 자동 검사 결과가 눈으로 보는 것과 다르면 **측정 도구를 먼저 의심한다.**

---

## 프로젝트 개요

OPIc 시험 대비 학습 SaaS 플랫폼.
학원(조직) 단위로 강사-학생을 관리하고, 스크립트 기반 연습 + AI 피드백을 제공.

### 핵심 가치
- **B2B SaaS**: 학원(조직) 단위 구독, 멀티 테넌트 데이터 격리
- **강사-학생 연계**: 강사가 학생별 맞춤 스크립트 작성
- **실전 연습**: Ava 음성(TTS)으로 질문 듣고 녹음 연습
- **AI 피드백**: 스크립트 vs 실제 답변 비교 분석 (Claude)
- **학습 기록**: 연습 이력, 진도 추적, 통계 대시보드

### 사용자 역할 (3계층)

| 계층 | 필드 | 역할 | 설명 |
|------|------|------|------|
| Platform | `users.platform_role` | `super_admin` | SaaS 전체 관리자 |
| Organization | `organization_members.role` | `owner` | 학원장 (구독/결제 관리) |
| | | `teacher` | 강사 (스크립트/피드백) |
| | | `student` | 학생 (연습/녹음) |
| ~~Legacy~~ | ~~`users.role`~~ | ~~`admin/teacher/student`~~ | ✅ 037~038에서 완전 제거. `get_user_role()`은 `organization_members` 기반으로 재작성 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React Native + Expo (SDK 52+), Expo Router, NativeWind |
| 백엔드 | Supabase (Auth, PostgreSQL, Storage, Edge Functions) |
| AI & 음성 | OpenAI Whisper (STT), OpenAI TTS, Claude Haiku (피드백) |
| 결제 | TOSS Payments (빌링키 방식) |
| 배포 | EAS Build (모바일), Vercel (웹), Google Play |

---

## 프로젝트 구조

```
app/
├── (auth)/          # 인증: login, signup, verify-email, confirm, forgot-password
├── (admin)/         # 슈퍼 관리자: 대시보드, 학원/사용자/구독/랜딩 관리
│   └── (tabs)/      # 6탭: index, landing, academies, users, billing, settings
├── (teacher)/       # 강사: 대시보드, 학생/반/스크립트/초대/구독 관리
│   └── (tabs)/      # 5탭: index, classes, invite, exam, settings
├── (student)/       # 학생: 연습, 이력, 토픽, 연결
│   └── (tabs)/      # 4탭: index, exam, history, settings
├── join/[code].tsx   # 공개 초대 링크 (speaky.co.kr/join/CODE)
└── index.tsx        # 랜딩 페이지 (미인증) / 홈 리다이렉트 (인증)

services/            # 14개 서비스 (admin, billing, classes, connection, exams, invites,
                     #   landing, messages, notifications, organizations, practices,
                     #   scripts, students, topics)
hooks/               # 7개 훅 (useAuth, useSubscription, useTheme,
                     #   usePushNotifications, useAppState, useNetworkStatus)
lib/                 # errors.ts, types.ts, constants.ts, validations.ts, supabase.ts, query.ts
supabase/
├── functions/       # 8개 Edge Functions + _shared
└── migrations/      # 32개 마이그레이션 (001~032)
```

---



## 웹 배포와 법정 표시 사항

> **`app.config.js` 의 `web.output` 은 `'static'` 이다. `'single'` 로 되돌리지 않는다.**

### 왜 static 인가

`'single'` 은 경로가 몇 개든 HTML 을 하나만 만든다. 서버는 빈 껍데기(1.4KB)를
주고 본문은 브라우저가 자바스크립트를 돌린 뒤에야 생긴다. 사람은 잘 보지만
**심사 크롤러 · 검색엔진 · 링크 미리보기는 그것을 보지 않는다.**

실제로 포트원 결제대행 심사가 "사업자 정보 없음 / 환불 정책 확인 불가" 로
반려했다. 환불 조항은 이용약관에 있었고 사업자 정보도 푸터에 넣을 수 있었지만,
HTML 에 글자가 한 자도 없었다.

`'static'` 은 빌드 때 경로마다 내용이 박힌 HTML 을 만든다. 약관은 여전히
`app/terms.tsx` **한 곳**에서 온다. `public/` 에 정적 HTML 을 따로 두는 방법도
있었지만 그러면 앱에 보이는 약관과 웹에 걸린 약관이 두 벌이 되고 언젠가
어긋난다 — 법정 문서에서 두 벌이 존재하는 것은 그 자체로 문제다.

### static 을 깨뜨리는 것들

빌드 때 각 화면을 Node 에서 한 번 그린다. 그래서 **브라우저에만 있는 것을
모듈 최상단에서 건드리면 빌드가 통째로 실패한다.**

| 함정 | 왜 위험한가 |
|------|------------|
| 브라우저 전용 패키지의 **정적 import** | 함수 안에 가드를 둬도 소용없다. import 는 파일을 읽는 순간 실행된다. `lib/analytics.ts` 가 `isSSR` 가드를 갖고도 빌드를 통째로 죽인 이유다 → `import type` + 동적 `import()` |
| 모듈 최상단의 `window`/`localStorage` | 프리렌더에는 없다 |
| 로그인 상태에 따라 화면을 가르는 최상위 라우트 | 빌드 시점엔 세션이 없다. `app/index.tsx` 는 프리렌더에서 랜딩을 그린다 — "아직 아무도 아닌 방문자" 가 볼 화면이 맞다 |

⚠️ **빌드가 종료 코드 0 을 내도 성공이 아니다.** 프리렌더가 전부 실패해도 0 이 나온다.
`find dist -name '*.html' | wc -l` 로 장수를 확인한다 (정상: 160장 이상).

### vercel.json — 두 가지를 같이 봐야 한다

```json
{ "cleanUrls": true,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

| 항목 | 왜 |
|------|-----|
| `cleanUrls` | `terms.html` 을 `/terms` 로 서빙한다. **없으면 확장자 없는 경로가 파일과 매칭되지 않아 아래 포괄 rewrite 로 떨어지고, 경로별 HTML 을 165장 만들어놓고도 전부 index.html 이 나간다.** 실제로 배포 후 `/terms` 가 랜딩을 돌려줬다 |
| 포괄 rewrite | 지운다. `/join/CODE` 처럼 미리 만들 수 없는 동적 경로는 클라이언트 라우터가 받아야 한다 |

⚠️ **`vercel.json` 에 주석을 넣지 않는다.** JSON 에 주석이 없다고 `"//"` 키를
쓰면 Vercel 이 스키마 검증에서 설정 파일 전체를 거부하고 **배포가 조용히
실패한다.** 사이트는 이전 버전 그대로 떠 있어서 성공한 것처럼 보인다.
설명이 필요하면 여기(CLAUDE.md)에 적는다.

⚠️ **배포 후 실제 URL 을 확인한다.** `dist` 에 파일이 만들어진 것과 그 파일이
서빙되는 것은 다르다. 로컬 빌드만 보고 넘어가면 위 두 문제를 못 잡는다.

```bash
curl -sL https://www.speaky.co.kr/terms | grep -c '제1조'   # 0 이면 실패
```

### 링크는 `<Link>` 로

`Pressable` + `router.push()` 는 웹에서 `<a href>` 가 아니라 그냥 `<div>` 다.
크롤러가 따라갈 링크 자체가 없다. 공개 페이지 사이의 이동은 `expo-router` 의
`<Link>` 를 쓴다.

### 법정 표시 사항

| 항목 | 위치 |
|------|------|
| 사업자 정보 | `lib/constants.ts` 의 `BUSINESS` — **값은 여기 한 곳에서만 온다** |
| 표시 컴포넌트 | `components/BusinessInfo.tsx` — 랜딩 · 약관 · 방침 · 환불 푸터에 공통 |
| 환불/청약철회 | `app/refund.tsx` (`/refund`) — 약관 제9조와 내용이 어긋나면 안 된다 |
| 문의 이메일 | `CONTACT.SUPPORT_EMAIL` |

⚠️ `speaky.co.kr` 에는 **수신용 MX 가 없다.** 발송(Resend/SES) 만 설정돼 있어
`@speaky.co.kr` 로 온 메일은 받을 수 없다. 문의 창구는 `onthegostudio.kr`
(Zoho 메일) 을 쓴다.

⚠️ **통신판매업 신고번호가 아직 없다** (`BUSINESS.MAIL_ORDER_NO` 가 빈 문자열).
전자상거래법 표시 의무이고 PG 심사가 요구한다. 번호가 나오면 그 상수만 채우면
모든 페이지에 반영된다. 비어 있으면 줄 자체를 그리지 않는다 — "준비중" 같은
문구는 표시로 인정되지 않으면서 미비만 드러낸다.


## 서버 데이터 캐시 (lib/query.ts)

> **화면에서 서버 데이터를 조회할 때는 `useQuery` 를 쓴다. `useState` + `useEffect` 로
> 직접 조회하지 않는다.**

### 왜 넣었나

조회 결과가 화면 컴포넌트의 `useState` 안에만 살았다. 컴포넌트가 언마운트되면
데이터도 같이 죽으니, 뒤로 돌아오거나 탭을 옮길 때마다 보여줄 게 없어
**스켈레톤부터 다시 떴다.** 41개 화면이 같은 패턴을 각자 복사해 갖고 있었다.

증상은 더 있었다. 같은 데이터를 화면마다 다시 조회했고, 한 곳에서 바꾼 게 다른
곳에 반영되지 않아 **`router.replace` 로 화면을 통째로 다시 만드는 꼼수**가 생겼다.
그 꼼수가 다시 스켈레톤을 부르는 순환이었다.

캐시를 컴포넌트 바깥에 두면 이 문제는 고쳐지는 게 아니라 **사라진다** — 다시
마운트돼도 직전 데이터가 그대로 있으니 띄울 스켈레톤이 없다.

### 규약

| 항목 | 규칙 |
|------|------|
| 쿼리 키 | `lib/query.ts` 의 `queryKeys` 만 쓴다. 문자열을 화면에 직접 적지 않는다 (오타가 조용히 다른 캐시를 만든다) |
| 서비스 연결 | `queryFn: () => unwrap(getXxx())` — `{ data, error }` 를 던지는 규약으로 바꾼다 |
| "없음" vs 실패 | 서비스가 `data: null, error: null` 을 주면 정상적인 "없음" 이다. 목록이면 `?? []` 로 받는다 |
| 스켈레톤 조건 | **`isPending`** (보여줄 데이터가 없음). `isFetching` 을 쓰면 갱신 때마다 깜빡인다 |
| 당겨서 새로고침 | `isRefetching` + `refetch()` |
| 쓰기 후 | `invalidateQueries({ queryKey: queryKeys.practices.all })` — 앞부분만 주면 하위가 전부 걸린다 |
| 즉시 반영 | 재조회를 기다리지 않아야 하면 `setQueryData` 로 캐시를 직접 고친다 |

### 기본 설정과 그 이유

| 옵션 | 값 | 이유 |
|------|-----|------|
| `staleTime` | 30초 | 화면을 빠르게 오갈 때 같은 요청이 연달아 나가는 것을 막는다 |
| `gcTime` | 30분 | **스켈레톤 깜빡임을 없애는 값이 이것이다.** 기본 5분은 앱을 잠깐 두고 온 사이 비어버린다 |
| `retry` | 1 | 인가 실패처럼 다시 해도 같은 답이 오는 에러를 반복하지 않는다 |

`initQueryClientBindings()` 가 NetInfo 와 AppState 를 `onlineManager` / `focusManager`
에 연결한다. 이것이 **`useOfflineGuard` 를 대체한다** — 화면마다 하던 일을 한 곳에서 한다.

### ⚠️ 네비게이션과 함께 봐야 한다

`router.replace` 로 탭 홈에 가면 스택이 무너지고 화면이 **새로 마운트된다.**
뒤로 가는 것처럼 보이지만 실제로는 새 화면을 세우는 것이다.

| 하려는 것 | 쓸 것 |
|-----------|-------|
| 히스토리에 있는 화면으로 되돌아가기 | `router.dismissTo(href)` |
| 스택을 접고 탭 홈으로 | `router.dismissAll()` |
| 이미 떠 있는 탭으로 옮기기 | `router.navigate(href)` |
| 되돌아오면 안 되는 화면 떠나기 (녹음 → 결과) | `router.replace` — 여기서는 맞다 |

### 이전 상태

| 화면 | 상태 |
|------|------|
| 학생 홈 · 이력 · 토픽 상세 · 스크립트 상세 | ✅ 이전 완료 |
| 나머지 | `useState` + `useEffect`. 손댈 일이 있을 때 함께 옮긴다 |
| 신규 화면 | 무조건 `useQuery` |


## 상수 정의 (lib/constants.ts)

```typescript
// 역할
USER_ROLES    // admin, teacher, student (레거시)
ORG_ROLES     // owner, teacher, student (현재)
PLATFORM_ROLES // super_admin

// 상태
INVITE_STATUS  // pending, used, expired
SCRIPT_STATUS  // draft, complete

// 콘텐츠
QUESTION_TYPES    // describe, routine, experience, comparison, roleplay, advanced
TOPIC_CATEGORIES  // survey, unexpected
API_TYPES         // whisper, claude, tts
NOTIFICATION_TYPES // practice_completed, teacher_feedback, new_script, student_connected

// 서베이/시험
SURVEY_CONFIG.TOTAL_MIN_SELECTIONS  // 12 (서베이 토픽 최소 선택 수)
PLAN_KEYS / PAID_PLAN_KEYS / ALL_PLAN_KEYS  // 구독 플랜 키 (중앙 관리)
PRACTICE_STEP_LABELS  // 연습 처리 단계 라벨 (upload, save, stt, feedback, done)
EXAM_STAGE_LABELS     // 시험 처리 단계 라벨 (upload, stt, evaluate)
DIFFICULTY_GRADE_LABELS  // 난이도→OPIc 등급 매핑
STRATEGY_GROUP_INFO   // 전략 그룹 라벨/아이콘 (survey-guide.tsx용)

// 설정
APP_CONFIG.API_RATE_LIMIT  // whisper: 30/h, claude: 30/h, tts: 50/h (표시용, 실제: _shared/constants.ts RATE_LIMITS)
APP_CONFIG.INVITE_CODE_LENGTH   // 6
APP_CONFIG.MAX_RECORDING_DURATION_SEC // 120 (2분)
STORAGE_BUCKETS  // practice-recordings, question-audio, landing-assets

// 색상
COLORS.PRIMARY  // #D4707F (딥 로즈)
```

---

## 권한 매트릭스

**범례**: ✅ 가능 | ❌ 불가 | 🔸 조건부

| 테이블 | super_admin | owner/admin | teacher | student | 조건 |
|--------|:-----------:|:-----------:|:-------:|:-------:|------|
| users | ✅ | 🔸 | 🔸 | 🔸 | SA: 전체 / owner: 같은 조직원 / 나머지: 본인+연결 |
| organizations | ✅ | 🔸 | ❌ | ❌ | owner: 본인 조직 |
| scripts | 🔸 | 🔸 | 🔸 | 🔸 | teacher: 본인 작성(CRUD) / student: 본인 것(읽기+content 수정) |
| practices | 🔸 | 🔸 | 🔸 | 🔸 | teacher: 연결된 학생 / student: 본인 |
| invites | 🔸 | 🔸 | 🔸 | 🔸 | teacher: 본인 것 / student: 코드 사용 |
| subscriptions | ✅ | 🔸 | ❌ | ❌ | owner: 본인 조직 |
| topics, questions | ✅ | ✅ | ✅ | ✅ | 공개 (읽기 전용) |

---

## RLS 클라이언트 코드 규칙

> **`.update()` 또는 `.delete()`를 클라이언트에서 호출할 때, 반드시 해당 테이블에 FOR UPDATE / FOR DELETE RLS 정책이 존재하는지 확인할 것.**
>
> PostgreSQL RLS는 권한 없는 행을 "존재하지 않는 것"으로 처리하므로, 정책이 없으면 **에러 없이 0건 처리**(silent fail)된다. `error`가 `null`이어도 실제로 반영되지 않을 수 있다.

---

## 문제 해결 원칙

> **항상 문제가 발생하면 근본 원인을 찾고, 보안·인증·데이터 중복·ERD 권한 등 모든 사항을 고려해서 가장 일관적이고 정확한 해결책을 먼저 찾을 것.**
> **임시방편의 해결책은 결국 또 다른 문제를 발생시킨다.**

1. 증상이 아닌 **근본 원인(root cause)** 을 먼저 파악
2. 보안, 인증, 데이터 무결성, ERD 권한을 **함께** 검토
3. 단일 패치가 아닌 **일관된 아키텍처 수준의 해결책** 적용
4. 해결 후 동일 패턴의 다른 코드에도 **동일 원칙 적용** 여부 확인
5. **교체 완결성(Replacement Completeness)**: 새 메커니즘 B를 도입해서 기존 A를 대체했으면, A가 완전히 제거되었는지 확인
   - AI 프롬프트: Structured Outputs 도입 → 프롬프트 내 형식 설명 제거
   - API 스키마: v2 필드 추가 → v1 중복 필드를 required에서 제거 (화면 폴백은 DB 기존 데이터용으로 유지)
   - 코드/설정: 새 함수·config가 기존을 대체 → 기존 것 삭제
   - **검증 질문**: "이 변경이 기존 코드/설정을 대체하는가? → YES면 대체된 것이 완전히 제거되었는가?"

---

## 보안 핵심 원칙

> **근본 원인: 서버가 클라이언트 입력을 신뢰하는 패턴**
> **원칙: 권한 있는 작업은 반드시 서버에서 결정/검증**

### 적용된 보안 패턴

| 위협 | 근본 해결책 | 구현 |
|------|------------|------|
| 회원가입 시 역할 조작 | DB 트리거에서 role 강제 지정 | `handle_new_user` → 항상 'student' |
| 역할 자체 변경 | BEFORE UPDATE 트리거 + 컬럼 화이트리스트 | `protect_user_columns` → role, email, id, created_at 변경 차단 |
| 강사 계정 생성 | admin 전용 SECURITY DEFINER RPC | `promote_to_teacher(user_id)` |
| 오디오 경로 조작 | 서버에서 소유권 검증 | whisper-stt: `audioPath.startsWith(user.id/)` + `..` 차단 |
| TTS 텍스트 주입 | 서버가 DB에서 직접 조회 | tts-generate: questionId만 받고 question_text는 DB에서 |
| 알림 수신자 조작 | 서버가 DB 관계 기반으로 결정 | `notify_action` RPC: SECURITY DEFINER |
| 알림 배달 무단 트리거 | 데이터 레벨 소유권 (created_by) | `deliver-notification`: `created_by = auth.uid()` 검증 |
| 초대 코드 무단 삭제 | 서버 RPC에서 소유권 검증 | `soft_delete_invite` RPC: `teacher_id = auth.uid()` |
| 연습 통계 무단 조회 | 본인 또는 연결된 강사만 허용 | `get_student_practice_stats`: `auth.uid()` + 연결 관계 검증 |
| 데이터 조회 전 인가 | 쿼리 레벨에서 필터링 | `getPracticeForTeacher`: `!inner` JOIN + `.eq('script.teacher_id')` |
| 이메일 인증 브루트포스 | 클라이언트 시도 제한 + 서버 rate limit | 5회 실패 → 3분 잠금 + OTP 만료 |
| URL 토큰 잔존 | 토큰 추출 즉시 제거 | `window.history.replaceState` |

### 보호 컬럼 트리거 bypass 원리 (PostgreSQL 내장 역할 시스템)
```sql
-- protect_user_columns 트리거 내부:
-- 일반 클라이언트 (authenticated/anon) → 보호 컬럼 변경 차단
-- SECURITY DEFINER 함수 (current_user = postgres) → 신뢰된 서버 코드, 자동 bypass
IF current_user NOT IN ('authenticated', 'anon') THEN
  RETURN NEW;  -- 세션 변수 불필요, PostgreSQL 역할 시스템에 의존
END IF;
```

### 회원가입 + 이메일 인증 플로우
```
클라이언트 → signUp(email, password, name)  ← role 전달 금지
   ↓
auth.users 생성 → handle_new_user 트리거 → public.users INSERT (role='student' 강제)
   ↓
이메일 인증 ON → 6자리 OTP 코드 발송 → verify-email 화면에서 입력
   ↓
supabase.auth.verifyOtp({ email, token, type: 'email' }) → 세션 생성
   ↓
강사 승격 필요 시 → admin이 promote_to_teacher RPC 호출
```

### 인가 + 데이터 무결성 원칙 (013_authorization_fixes.sql)

> **Part A 근본 원인: 인증(Authentication) ≠ 인가(Authorization) 구분 실패**
> **원칙: 모든 데이터 접근 경로에 인가를 일관되게 적용**

- `notification_logs.created_by`: 알림 생성 행위자 기록 → deliver-notification에서 `created_by = auth.uid()` 검증
- `soft_delete_invite` RPC: 006에서 DELETE policy DROP 후 미재생성 → RPC로 근본 해결 (서버가 소유권 검증)
- `get_student_practice_stats`: plpgsql 변환 + `auth.uid()` + 연결 관계 검증 (본인/연결 강사만)
- `getPracticeForTeacher`: `!inner` JOIN + `.eq('script.teacher_id', user.id)` 쿼리 레벨 인가
- PostgREST `!inner` JOIN: 없으면 LEFT JOIN → 필터 무시됨. 관련 테이블 필터링 시 반드시 `!inner` 사용

> **Part B 근본 원인: TOCTOU(Time-of-Check-to-Time-of-Use) 레이스 컨디션**
> **원칙: "확인 후 행동" 패턴을 원자적 연산으로 결합**

| 문제 | 패턴 | 해결 | 적용 |
|------|------|------|------|
| 초대 코드 동시 사용 | CAS (Compare-And-Swap) | `UPDATE WHERE status='pending'` + `GET DIAGNOSTICS ROW_COUNT` | `use_invite_code` |
| 알림 중복 생성 | UNIQUE + ON CONFLICT | `notification_logs.resource_id` UNIQUE 인덱스 + `ON CONFLICT DO NOTHING` | `notify_action` |
| 피드백 중복 INSERT | UPSERT | `.upsert({...}, { onConflict: 'practice_id' })` | `saveTeacherFeedback` |

### 클라이언트 상태 동기화 원칙

> **원칙: 서버가 단일 소스(Single Source of Truth), 클라이언트 캐시를 신뢰하지 않음**

- 초기화: `getUser()` 사용 (NOT `getSession()`). 서버에 토큰 유효성 검증 요청.
- `TOKEN_REFRESHED`: DB에서 user profile 재조회. role 변경 등 서버 상태 반영.

### API Rate Limiting 원칙

> **원칙: 비용 드는 외부 API 호출 전에 반드시 `check_api_rate_limit` 사전 확인**

| Edge Function | API | 제한 | 비고 |
|--------------|-----|------|------|
| `whisper-stt` | OpenAI Whisper | 30/시간 | |
| `tts-generate` | OpenAI TTS | 50/시간 | 캐시 히트 후 체크 (캐시 시 미소비) |
| `claude-feedback` | Claude API | 30/시간 | |

429 반환 시 `{ error, remaining, reset_at }` 포함.

---

## RPC 함수 설계 원칙

### 원칙 1: 복잡한 데이터 집계는 서버에서 처리
```typescript
// ❌ N+1 쿼리
const students = await getStudents();
for (const s of students) {
  await getScripts(s.id);
}

// ✅ 단일 RPC 호출
const result = await supabase.rpc('get_teacher_students');
```

### 원칙 2: 모든 쿼리에 deleted_at IS NULL 조건

### 원칙 3: auth.uid() 검증 필수
```sql
v_user_id := auth.uid();
IF v_user_id IS NULL THEN
  RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
END IF;
```

### 주요 RPC 함수 목록

**인증/역할**:
| 함수 | 용도 |
|------|------|
| `get_user_role` | 사용자 역할 조회 (org_members 기반, 037에서 재작성) |
| `is_super_admin` | 플랫폼 관리자 확인 |
| `is_org_member` | 조직 멤버 확인 |
| `can_teach_in_org` | 강사/원장 확인 |
| `get_user_org_role` | 특정 조직 내 역할 |
| `promote_to_teacher` | admin 전용 강사 승격 (SECURITY DEFINER) |

**조직 관리**:
| 함수 | 용도 |
|------|------|
| `get_my_organizations` | 내 조직 목록 |
| `get_org_teachers` | 조직 강사 목록 |
| `remove_org_member` | 멤버 제거 (SECURITY DEFINER) |
| `change_member_role` | 역할 변경 |
| `update_organization_name` | 조직명 변경 |

**초대/연결**:
| 함수 | 용도 |
|------|------|
| `create_invite` | 초대 코드 생성 (반 연결 + 다회용 지원) |
| `use_invite_code` | 초대 코드 사용 (다회용 CAS + 반 자동 배정 + SECURITY DEFINER) |
| `soft_delete_invite` | 초대 삭제 (소유권 검증) |
| `get_invite_usage_stats` | 초대 코드 사용 현황 (강사 전용) |

**학생/학습**:
| 함수 | 용도 |
|------|------|
| `get_teacher_students` | 강사의 학생 목록 + 통계 |
| `get_student_detail` | 학생 상세 정보 |
| `get_student_practice_stats` | 연습 통계 (인가 검증) |
| `get_student_topics_with_progress` | 토픽별 진도 |
| `get_topic_questions_with_scripts` | 질문 + 스크립트/연습 데이터 |
| `set_student_topics` | 토픽 일괄 배정 |

**반 관리**:
| 함수 | 용도 |
|------|------|
| `create_class` / `update_class` / `soft_delete_class` | 반 CRUD |
| `get_teacher_classes` / `get_class_detail` | 반 조회 |
| `add_class_member` / `remove_class_member` | 반원 관리 |

**알림**:
| 함수 | 용도 |
|------|------|
| `notify_action` | 알림 생성 (SECURITY DEFINER, resource_id UNIQUE 중복 방지) |

**구독/결제**:
| 함수 | 용도 |
|------|------|
| `check_org_entitlement` | Feature gating + 쿼터 확인 |
| `check_api_rate_limit` | API 호출 전 rate limit 확인 |
| `log_api_usage` | API 사용량 기록 |
| `validate_subscription_change` | 구독 변경 트리거 |

**메시징**:
| 함수 | 용도 |
|------|------|
| `send_message` | 메시지 발송 (반/개인 팬아웃 + 알림 생성, SECURITY DEFINER) |
| `get_my_messages` | 학생 수신함 조회 (sender_name, class_name, read_at 포함) |
| `get_sent_messages` | 강사 발송 이력 (recipient_count, read_count 포함) |
| `mark_message_read` | 메시지 읽음 처리 (recipient_id = auth.uid()) |
| `get_unread_message_count` | 안 읽은 메시지 수 조회 |

**온보딩**:
| 함수 | 용도 |
|------|------|
| `get_onboarding_status` | 온보딩 단계 상태 조회 (owner 전용) |
| `complete_onboarding` | 온보딩 완료 처리 |

**어드민**:
| 함수 | 용도 |
|------|------|
| `get_admin_dashboard_stats` | KPI 통계 |
| `admin_list_users` | 사용자 목록 (effective_role 포함) |
| `admin_change_user_role` | 사용자 역할 변경 |
| `admin_list_organizations` | 조직 목록 |
| `admin_update_organization` / `admin_delete_organization` | 조직 관리 |
| `admin_get_subscription_stats` | 구독 통계 (MRR 등) |
| `admin_update_subscription` / `admin_cancel_subscription` | 구독 관리 |
| `admin_create_owner_invite` / `admin_list_owner_invites` / `admin_delete_owner_invite` | 원장 초대 |
| `admin_update_landing_section` / `admin_upsert_landing_item` / `admin_delete_landing_item` / `admin_reorder_items` | 랜딩 CMS |
| `admin_get_user_by_id` | 사용자 상세 (effective_role + 소속 조직) |

---

## Edge Functions (13개)

| 함수 | 용도 | 외부 API |
|------|------|---------|
| `whisper-stt` | 음성 → 텍스트 변환 | OpenAI Whisper |
| `tts-generate` | 텍스트 → 음성 변환 | OpenAI TTS |
| `claude-feedback` | AI 피드백 생성 (스크립트 연습) | Claude Haiku 4.5 |
| `claude-exam-evaluate` | 모의고사 AI 평가 (ACTFL 4차원 채점) | Claude Haiku 4.5 |
| `deliver-notification` | 푸시 알림 배달 | Expo Push |
| `billing-key` | TOSS 빌링키 발급 | TOSS Payments |
| `toss-webhook` | 결제 웹훅 처리 + webhook_logs 기록 + 결제 확인 이메일 | TOSS Payments, Resend |
| `subscription-renew` | 구독 자동 갱신 + Dunning/트라이얼/취소 이메일 | TOSS Payments, Resend |
| `request-refund` | 관리자 환불 처리 | TOSS Payments |
| `delete-user` | 사용자 데이터 삭제 | — |
| `update-billing-key` | 결제 수단 변경 (빌링키 재발급) | TOSS Payments |
| `change-plan` | 플랜 업/다운그레이드 (proration) | TOSS Payments |
| `translate-script` | 영→한 스크립트 번역 (캐싱) | Claude Haiku 4.5 |

---

## 구독/결제 시스템

### 구조
- **조직 기반**: `subscriptions` 테이블에 `organization_id` (+ 레거시 `user_id` 폴백)
- **플랜**: `subscription_plans` — plan_key, price_monthly, price_yearly, max_students, max_scripts, features[]
- **결제**: TOSS Payments 빌링키 방식 → `payment_history` 추적
- **Feature Gating**: `check_org_entitlement(feature_key)` RPC
  - `ai_feedback`, `tts`, `max_students`, `max_scripts`
  - 무료 기본: 학생 3명, 스크립트 5개
  - RPC 미존재 시 무료 폴백 (보수적)
  - ✅ **서버 사이드 쿼터 검증**: `use_invite_code`에 max_students 체크, scripts INSERT 트리거로 max_scripts 체크 (043 마이그레이션)

### 상태
- `active`, `trialing`, `past_due`, `canceled`, `incomplete`

---

## TOSS Payments 결제 아키텍처 (상용 레퍼런스)

> **이 섹션은 실제 프로덕션에서 검증된 TOSS 빌링키 결제 패턴입니다.**
> **다음 상용 앱 개발 시 결제 시스템의 레퍼런스로 사용하세요.**

### 1. 핵심 사실: 빌링키 결제는 웹훅이 오지 않는다

```
⚠️ 가장 중요한 사실:
TOSS 자동결제(빌링키 결제)는 결제 완료 시 PAYMENT_STATUS_CHANGED 웹훅을 전송하지 않습니다.
웹훅은 checkout(일반 결제창) 방식에서만 발생합니다.

→ 빌링키 결제의 성공/실패 처리는 반드시 API 응답에서 직접 처리해야 합니다.
→ 웹훅에 의존한 reconciliation은 절대 작동하지 않습니다.
```

### 2. 결제 플로우 (billing-key Edge Function)

```
클라이언트 → billing-key Edge Function
  ↓
1. 인증/인가 검증 (JWT + org owner 확인)
2. 서버에서 플랜 가격 조회 (클라이언트 금액 절대 불신)
3. Race Condition 방지: incomplete 구독 먼저 INSERT (UNIQUE 제약으로 동시 요청 차단)
4. authKey → TOSS API → billingKey 교환
5. billingKey 암호화 저장 (AES-256-GCM)
6. 첫 결제 실행 (Idempotency-Key + taxFreeAmount: 0)
7. DB 활성화 (3회 재시도 + CAS)
8. 3회 실패 시 → TOSS 자동 환불 + incomplete 정리
```

### 3. TOSS API 필수 헤더/파라미터

```typescript
// 인증 헤더 (모든 TOSS API 호출)
const authHeader = 'Basic ' + btoa(`${tossSecretKey}:`);  // 콜론 필수

// 결제 요청 필수 파라미터
{
  customerKey: user.id,        // TOSS에 등록된 고객 식별자
  amount: number,              // 서버에서 조회한 금액 (클라이언트 불신)
  orderId: string,             // 고유 주문 ID (멱등성 키와 별도)
  orderName: string,           // 주문명
  taxFreeAmount: 0,            // SaaS는 면세 아님 → 반드시 0 명시
}

// 멱등성 헤더 (POST API에 필수)
headers: {
  'Idempotency-Key': orderId,  // 동일 요청 중복 결제 방지, 최대 300자, 15일 유효
}
```

### 4. TOSS 에러 처리 패턴

```typescript
// ALREADY_PROCESSED_PAYMENT: 성공으로 처리 (멱등성)
if (paymentResBody.code === 'ALREADY_PROCESSED_PAYMENT') {
  logger.info('Already processed, treating as success', { orderId });
  // 아래 로직 계속 진행 (구독 활성화 등)
} else {
  // 진짜 에러 → 롤백
}

// 결제 응답 검증 (paymentKey + status 확인)
if (!paymentData.paymentKey || paymentData.status !== 'DONE') {
  // 비정상 응답 → 롤백
}
```

### 5. DB 활성화 3회 재시도 + 자동 환불 패턴

```typescript
// 결제 성공 후 DB 업데이트 실패 대비: 3회 재시도
let subscription = null;
let activationError = null;

for (let attempt = 1; attempt <= 3; attempt++) {
  const { data: sub, error: err } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'active', ... })
    .eq('id', lockSubId)
    .eq('status', 'incomplete')  // CAS: incomplete인 경우에만 전환
    .select('id')
    .single();

  if (!err && sub) { subscription = sub; break; }
  activationError = err;
  if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
}

if (!subscription) {
  // 이미 active인지 확인 (재시도 중 성공했지만 응답 못 받은 경우)
  const { data: currentSub } = await supabaseAdmin
    .from('subscriptions').select('id, status').eq('id', lockSubId).single();

  if (currentSub?.status === 'active') {
    subscription = { id: lockSubId };  // 이미 성공
  } else {
    // 진짜 복구 불가 → TOSS 결제 취소(환불)
    await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Idempotency-Key': `refund_${orderId}` },
      body: JSON.stringify({ cancelReason: 'DB 활성화 실패 자동 환불' }),
    });
    await supabaseAdmin.from('subscriptions').delete().eq('id', lockSubId);
  }
}
```

### 6. TOSS 웹훅 처리 (toss-webhook Edge Function)

```typescript
// ⚠️ 웹훅은 checkout 결제에서만 수신됨 (빌링키 결제는 미수신)

// TOSS 웹훅 이벤트 구조:
// { eventType: "PAYMENT_STATUS_CHANGED", data: { status: "DONE", paymentKey: "..." } }
// eventType이 직접 "DONE"이 아님! data.status에서 실제 상태 확인

const paymentStatus = (eventType === 'PAYMENT_STATUS_CHANGED')
  ? data?.status   // "DONE" | "CANCELED" | "ABORTED" | "FAILED"
  : eventType;     // 레거시 호환

// 서명 검증: 결제 웹훅에는 서명 없음, 정산 웹훅에만 있음
// → 서명 헤더 존재 시에만 검증 (없으면 건너뛰기)
const hasSignature = !!req.headers.get('tosspayments-webhook-signature');
if (hasSignature && tossWebhookSecret) {
  // HMAC-SHA256 검증 (아래 참고)
}
```

### 7. TOSS 웹훅 서명 검증 (정산 웹훅용)

```typescript
// 헤더: tosspayments-webhook-signature (v1:base64sig 형식)
// 페이로드: body + ":" + tosspayments-webhook-transmission-time
// 서명 형식: "v1:base64sig1,v1:base64sig2" (쉼표 구분, 복수 가능)

async function verifySignature(body: string, req: Request, secretKey: string): Promise<boolean> {
  const signature = req.headers.get('tosspayments-webhook-signature') || '';
  const transmissionTime = req.headers.get('tosspayments-webhook-transmission-time') || '';
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const payload = transmissionTime ? `${body}:${transmissionTime}` : body;
  const computed = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));

  // "v1:base64sig1,v1:base64sig2" 파싱
  const signatures = signature.split(',').map(s => s.trim().replace(/^v1:/, ''));
  for (const sig of signatures) {
    const decoded = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    if (timingSafeEqual(computed, decoded)) return true;
  }
  return false;
}

// Timing-safe 비교 (타이밍 공격 방지)
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) { result |= a[i] ^ b[i]; }
  return result === 0;
}
```

### 8. Cron 기반 TOSS API 조회 복구 (subscription-renew)

```typescript
// 빌링키 결제는 웹훅이 오지 않으므로, cron에서 TOSS API로 직접 조회하여 복구
// 대상: 10분~24시간 된 incomplete 구독 (10분 미만은 billing-key가 아직 처리 중일 수 있음)

// TOSS 결제 조회 API
const tossRes = await fetch(
  `https://api.tosspayments.com/v1/payments/orders/${orderId}`,
  { method: 'GET', headers: { 'Authorization': authHeader } }
);

if (tossRes.ok) {
  const tossData = await tossRes.json();
  if (tossData.status === 'DONE') {
    // 결제 확인됨 → 구독 활성화 + payment_history 생성
  } else if (['CANCELED', 'ABORTED', 'EXPIRED'].includes(tossData.status)) {
    // 결제 실패/취소 → incomplete 삭제
  }
} else if (tossRes.status === 404) {
  // TOSS에 기록 없음 → incomplete 삭제
}

// 24시간 초과 incomplete → 무조건 삭제 (결제 시도 자체가 실패한 것)
```

### 9. 플랜 변경 (change-plan Edge Function)

```typescript
// 업그레이드: 일할 계산 후 즉시 결제 + 플랜 변경
const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
const daysRemaining = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
const proratedAmount = Math.round(priceDiff * (daysRemaining / totalDays));

// 결제 성공 후 DB 실패 시 → 자동 환불
// billing_key 복호화: isEncrypted() 체크 후 decryptValue()

// 다운그레이드: pending_plan_id 설정, 다음 갱신 시 적용
// 다운그레이드 전 사용량 초과 검증 (학생 수, 스크립트 수)
```

### 10. Race Condition 방지 패턴

```sql
-- 동시 결제 요청 방지: organization당 incomplete 구독 1개만 허용
CREATE UNIQUE INDEX idx_subscriptions_org_incomplete_unique
  ON subscriptions (organization_id) WHERE status = 'incomplete';

-- payment_history 중복 방지
CREATE UNIQUE INDEX idx_payment_history_provider_payment_id_unique
  ON payment_history (provider_payment_id) WHERE provider_payment_id IS NOT NULL;

-- orderId 조회 인덱스 (cron 복구용)
CREATE INDEX idx_subscriptions_provider_subscription_id
  ON subscriptions (provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
```

### 11. 보안 체크리스트

| 항목 | 구현 |
|------|------|
| 금액 조작 방지 | 서버에서 plan_key로 가격 조회 (클라이언트 금액 절대 불신) |
| 빌링키 보호 | AES-256-GCM 암호화 저장 (`encryptValue`/`decryptValue`) |
| 멱등성 | `Idempotency-Key` 헤더 + `ALREADY_PROCESSED_PAYMENT` 처리 |
| 중복 결제 | `provider_payment_id` UNIQUE 인덱스 |
| 동시 요청 | `incomplete` UNIQUE 인덱스 + CAS 패턴 |
| 에러 메시지 | 고정 `'Internal server error'` 반환 (내부 정보 미노출) |
| 웹훅 서명 | HMAC-SHA256 + timing-safe 비교 |
| Cron 인증 | `CRON_SECRET` 헤더 검증 (subscription-renew) |
| 인가 | org owner 검증 (organization_members 테이블) |
| 환불 안전망 | 결제 성공 + DB 실패 시 자동 환불 |

### 12. 복구 아키텍처 요약

```
[1차 방어] billing-key Edge Function
  → 결제 성공 → DB 활성화 3회 재시도
  → 3회 실패 → TOSS 자동 환불

[2차 방어] subscription-renew Cron (매시간)
  → 10분~24시간 된 incomplete 구독 탐지
  → TOSS API 조회 (GET /v1/payments/orders/{orderId})
  → DONE → 구독 활성화 / FAILED → incomplete 삭제
  → 24시간 초과 → 무조건 삭제

[결과] "돈 나갔는데 서비스 못 쓰는" 상황 원천 차단
```

### 13. Dunning (미수금 관리) 플로우

```
갱신 실패 → past_due + dunning_started_at 기록
  Day 0: 즉시 재시도 알림
  Day 3: 두 번째 알림
  Day 7: 세 번째 알림 (grace period 종료 경고)
  Day 14: 구독 취소 (canceled) + 최종 알림
  active 복구 시 → dunning_started_at 자동 클리어 (트리거)
```

---

## 개발 체크리스트

### Phase 1 — 완료 ✅
- [x] 프로젝트 초기 설정 + Supabase
- [x] 인증 (회원가입, 로그인, 이메일 OTP 인증, 비밀번호 재설정)
- [x] 강사 기능 (학생 관리, 스크립트 CRUD, 반 관리, 초대 코드)
- [x] 학생 기능 (연습, 녹음, 이력, 토픽 선택)
- [x] AI 연동 (Whisper STT, TTS, Claude 피드백)
- [x] 푸시 알림
- [x] 보안 (012 auth_security + 013 authorization_fixes)
- [x] 에러 처리 (53 에러코드, classifyError 통합)
- [x] 테스트 (428개 통과 — 9개 테스트 파일)

### Phase 2 — 완료 ✅
- [x] 조직(Organization) 시스템 (020 마이그레이션)
- [x] 멀티 테넌트 데이터 격리
- [x] 조직 역할 (owner, teacher, student)
- [x] 슈퍼 관리자 대시보드

### Phase 3 — 완료 ✅
- [x] 구독/결제 (TOSS Payments 빌링키)
- [x] Feature Gating (check_org_entitlement)
- [x] 랜딩 페이지 CMS (admin)
- [x] 웹 배포 (Vercel)

### Phase 4 — 레거시 제거 + 모의고사 ✅
- [x] 레거시 `users.role` 컬럼 완전 제거 (037~038 마이그레이션)
- [x] `get_user_role()` → `organization_members` 기반 재작성
- [x] 어드민 함수 `role='admin'` → `is_super_admin()` 전환
- [x] 모의고사 DB 스키마 (034~041 마이그레이션, 4개 테이블)
- [x] 모의고사 UI (ExamHub, MockSurvey, MockAssessment, ComboList, Session, Processing, Result, History)
- [x] 모의고사 서비스 레이어 (services/exams.ts, 12개 함수)
- [x] 모의고사 RPC 함수 (check_exam_availability, generate_mock/level_test_questions)
- [x] 모의고사 보안 트리거 (점수 보호, 상태 전이 강제, 조직 검증)
- [x] `claude-exam-evaluate` Edge Function (ACTFL 4차원 채점 + Structured Outputs)
- [x] 결과 처리 화면 (processing.tsx — 업로드→STT→AI 평가 진행률)
- [x] 결과 화면 (result.tsx — 등급/ACTFL 4차원/문항별 상세)
- [x] 콤보 롤플레이 선택 화면 (combo-list.tsx)
- [x] 시험 이력 화면 (history.tsx — 필터링 + sessionDetail 재사용)

### 웹/어드민 안정화 — 완료 ✅
- [x] 어드민 패널: academy/[id].tsx 쿼리 최적화 (042 마이그레이션 — listOrganizations 제거)
- [x] 웹 녹음: MediaRecorder 브라우저 호환성 가드 + mimeType 폴백 (webm→mp4)
- [x] 웹 녹음: uploadRecording 확장자 자동 결정 (blob.type 기반)
- [x] claude-feedback max_tokens 4096 복원, docs/FEATURES.md 녹음 시간 정정

### Phase 5 — Feature Gating 고도화 ✅
- [x] **서버 사이드 쿼터 검증** (043 마이그레이션)
  - `_check_org_quota(org_id, feature)`: auth.uid() 불필요한 내부 헬퍼
  - `use_invite_code`: max_students 쿼터 검증 (CAS 이전에 체크)
  - `enforce_script_quota` 트리거: scripts INSERT 시 max_scripts 검증
  - 에러 코드: STUDENT_QUOTA_EXCEEDED, SCRIPT_QUOTA_EXCEEDED → BILLING_QUOTA_EXCEEDED 매핑
- [x] **Feature 잠금 UI**
  - `FeatureLockBanner` 컴포넌트 (잠금 상태 + 업그레이드 CTA)
  - `QuotaIndicator` 컴포넌트 (잔여량 프로그레스 바)
  - 초대 화면: 학생 쿼터 인디케이터 표시
  - 스크립트 생성: 스크립트 쿼터 인디케이터 표시
- [x] **org_role 기반 인가 함수** — 037~038에서 이미 완료 (레거시 참조 0건 확인)

### Phase 6A — 구독 고도화 ✅
- [x] 결제 수단 변경 (`update-billing-key` Edge Function)
- [x] 플랜 업/다운그레이드 (`change-plan` Edge Function + proration)
- [x] 영수증 다운로드 (TOSS receipt_url 링크)
- [x] past_due grace period (7일 유예 — `check_org_entitlement` 업데이트)
- [x] 구독 상태 전이 트리거 (`enforce_subscription_status_transition`)
- [x] Dunning 강화 (14일 재시도 → canceled, `subscription-renew` 업데이트)
- [x] 다운그레이드 예약 (`pending_plan_id` + `subscription-renew` 적용)

### Phase 6B — Dunning 알림 + 취소 리텐션 ✅
- [x] Dunning 마일스톤 푸시 알림 (Day 0/3/7/14 — `subscription-renew` 내장)
- [x] `dunning_started_at` 컬럼 + 자동 클리어 트리거 (active 복구 시)
- [x] 취소 리텐션 플로우 (`CancellationFlow` 3단계 모달: 사유 → 제안 → 확인)
- [x] `cancellation_feedback` 테이블 + RLS + admin 통계 RPC
- [x] `submitCancellationFlow` 서비스 함수 (사유 기록 + 취소/다운그레이드/유지 분기)
- [x] 취소 사유 상수 (`CANCELLATION_REASONS` 6개)
- [x] `payment_failed` 알림 타입 추가

### Phase 6C — 연간 결제 ✅
- [x] `billing_cycle` 컬럼 (monthly/yearly ENUM)
- [x] `trial_ends_at` 컬럼 (트라이얼 종료일)
- [x] billing-key Edge Function: 연간 결제 지원 (`price_yearly` 사용, +12개월 기간)
- [x] subscription-renew: billing_cycle 기반 갱신 (1개월/12개월)
- [x] plan-select.tsx: 월간/연간 토글 UI + 할인율/절약 금액 표시
- [x] issueBillingKey 서비스: billingCycle 파라미터 추가
- [x] `get_plan_yearly_discount` RPC 함수

### Phase 7 — 한→영 연습 ✅
- [x] scripts.content_ko 컬럼 + 자동 리셋 트리거 (050 마이그레이션)
- [x] `translate-script` Edge Function (Claude Haiku, DB 캐싱)
- [x] 서비스: `translateScript()`, createScript/updateScript에서 fire-and-forget 번역
- [x] 한→영 연습 화면 (`translation-practice.tsx`)
- [x] 스크립트 상세 3버튼 UI (쉐도잉 / 한→영 / 실전 연습)

### Phase 8 — 초대 시스템 재설계 ✅
- [x] 반별 다회용 초대 코드 (054 마이그레이션)
- [x] `invite_uses` 테이블 + RLS (다회용 사용 이력)
- [x] `create_invite` RPC 재작성 (class_id, max_uses 파라미터)
- [x] `use_invite_code` RPC 재작성 (다회용 CAS + 반 자동 배정)
- [x] `get_invite_usage_stats` RPC (사용 현황 조회)
- [x] InviteCodeCard 재설계 (공유 3버튼: 코드/링크/QR)
- [x] InviteQRModal 컴포넌트 (QR 코드 모달)
- [x] 초대 화면: 반 선택 + 사용 횟수 선택
- [x] `/join/[code]` 공개 라우트 (웹 초대 링크)
- [x] `usePendingInvite` 훅 (auth flow 후 자동 코드 사용)
- [x] useAuth 라우팅: join 라우트 허용
- [x] 학생 connect 화면: 코드 프리필 지원

### Phase 9 — 상용화 인프라 ✅
- [x] Sentry 크래시/에러 모니터링 (`lib/sentry.ts`, `@sentry/react-native`)
- [x] 트라이얼 온보딩 (059 마이그레이션, 조직 생성 시 14일 Solo 체험 자동 생성)
- [x] 환불 Edge Function (`request-refund`, 월간/연간 정책 + forceRefund)
- [x] 환불 에러코드 4개 + 이용약관 업데이트
- [x] Webhook 이벤트 로깅 (060 마이그레이션, `webhook_logs` 테이블)
- [x] 비즈니스 이메일 서비스 (Resend, `_shared/email.ts`, 5개 템플릿)
- [x] 이메일 발송 로깅 (060 마이그레이션, `email_logs` 테이블)
- [x] 온보딩 위자드 (061 마이그레이션, 3단계 가이드 모달, `useOnboarding` 훅)
- [x] Analytics (Mixpanel, `lib/analytics.ts`, 자동 Screen Tracking)
- [x] 번역 재시도 로직 (`translateWithRetry`, 1회 재시도 + Sentry 로깅)

### Phase 10 — OPIc 서베이 구조 재설계 + 상수 중앙화 ✅
- [x] **OPIc 서베이 구조 재설계** (065 마이그레이션)
  - `topic_groups` 테이블 (7개 → 067에서 Q1~Q3 비활성화, 활성 4개: 여가/취미/운동/휴가)
  - 그룹별 선택 규칙 (`selection_type`: single/multiple, `min_selections`)
  - 기존 24개 토픽 그룹 재배치 + 신규 23개 서베이 토픽 추가
  - 신규 15개 돌발 토픽 추가 (기존 5개 + 15개 = 20개)
  - 토픽별 질문 4개씩 시드 (describe/routine/experience/comparison)
  - `set_student_topics` RPC 재작성 (서버 사이드 선택 규칙 검증, 총 12개 이상)
  - `get_student_topics_with_progress` RPC에 그룹 정보 추가
  - 058 마이그레이션 strategy_group NULL 버그 수정
- [x] **서베이 프로필 분리** (067 마이그레이션)
  - Q1~Q3(직업/학생/거주지)은 프로필 질문 → `student_survey_profiles` 테이블로 분리
  - Q4~Q7(여가/취미/운동/휴가)만 토픽 선택 → `topic_groups` 활성 4개
  - Q1~Q3용 신규 토픽(회사원/자영업 등 11개) 비활성화
  - 집/거주, 이웃/동네, 자기소개: 자동 배정 토픽 (`is_auto_assigned = true`)
  - `save_survey_profile` / `get_survey_profile` RPC 추가
  - `SurveyProfileSelector` 컴포넌트 (Q1~Q3 프로필 선택 UI)
  - 프로필 옵션 상수 (`SURVEY_JOB_OPTIONS`, `SURVEY_RESIDENCE_OPTIONS` 등)
- [x] **공유 컴포넌트**
  - `TopicGroupSelector` 컴포넌트 (그룹별 UI, 자동 배정 안내, profileSection prop)
  - `SurveyProfileSelector` 컴포넌트 (Q1~Q3 라디오/토글 UI)
  - `useTopicGroupToggle` 훅 (single 그룹 자동 해제 로직)
- [x] **화면 재작성** (3개 화면)
  - `topics.tsx`: 프로필(Q1~Q3) + 활동 토픽(Q4~Q7) 통합 화면
  - `mock-survey.tsx`: 모의고사 서베이 (Q4~Q7 활동 그룹만)
  - `assign-topics.tsx`: 강사 토픽 배정 (프로필 + 활동 토픽)
- [x] **상수 중앙화** (하드코딩 제거)
  - `PRACTICE_STEP_LABELS`: 연습 처리 단계 (2파일 중복 → 1곳)
  - `EXAM_STAGE_LABELS`: 시험 처리 단계 (로컬 → 상수)
  - `DIFFICULTY_GRADE_LABELS`: 난이도→등급 매핑 (로컬 → 상수)
  - `STRATEGY_GROUP_INFO`: 전략 그룹 라벨 (로컬 → 상수)
  - `PLAN_KEYS`/`PAID_PLAN_KEYS`/`ALL_PLAN_KEYS`: 플랜 키 (3곳 → 1곳)
  - `RATE_LIMITS` (Edge Functions `_shared/constants.ts`): API rate limit (5개 함수 → 1곳)
  - `TOPIC_CATEGORIES.*`: 카테고리 문자열 상수화 (13개 파일)
  - Rate limit 값 불일치 수정 (claude: 50→30, tts: 20→50)

### Phase 11 — 가격 조정 + Feature Gating 고도화 ✅
- [x] **가격 인상** (073 마이그레이션): Solo ₩49,900 / Pro ₩99,900 / Academy ₩299,000
- [x] **연간 할인 25%** 확대 (기존 21~22%)
- [x] **트라이얼 30일** 연장 (기존 14일 → 30일, `create_trial_subscription` 재작성)
- [x] **Free 티어 AI 피드백 월 5회** 무료 체험 (`_entitlement_free_default` 재작성)
- [x] **Free 티어 모의고사 월 2회** 제한 (`max_exams_monthly` 컬럼 + `check_exam_availability` 재작성)
- [x] 랜딩 페이지 pricing 시드 데이터 (DB CMS)
- [x] `LandingPage.tsx` 하드코딩 폴백 가격 업데이트
- [x] 이용약관 트라이얼 기간 30일 반영
- [x] `EXAM_MONTHLY_LIMIT` 에러코드 추가

### Phase 12 — 메시징 시스템 ✅
- [x] **`messages` + `message_recipients` 테이블** (074 마이그레이션)
- [x] `message_target_type` ENUM (class/individual)
- [x] `send_message` RPC (SECURITY DEFINER, 권한 검증 + 팬아웃 + 알림 생성)
- [x] `get_my_messages` RPC (학생 수신함, 발신자/반 이름 포함)
- [x] `get_sent_messages` RPC (강사 발송 이력, 읽음률 포함)
- [x] `mark_message_read` / `get_unread_message_count` RPC
- [x] RLS 정책 (발신자 조회 + 수신자 조회/읽음 업데이트)
- [x] `services/messages.ts` (5개 함수)
- [x] 강사 UI: 발송 이력 + 메시지 작성 (반/학생 선택)
- [x] 학생 UI: 수신함 (미읽음 표시 + 읽음 처리)
- [x] 강사/학생 탭 헤더에 메시지 아이콘 + 뱃지
- [x] 푸시 알림 네비게이션 (`message_id` → 학생 메시지 화면)
- [x] `NOTIFICATION_TYPES.NEW_MESSAGE`, `MESSAGE_TARGET_TYPES` 상수
- [x] `MSG_BODY_REQUIRED`, `MSG_INVALID_TARGET_TYPE` 에러코드

### 예정 📋
- [ ] Universal Links / App Links (Phase E — 별도 EAS 빌드 필요)
- [ ] 세금계산서 자동 발급 (팝빌/바로빌 API 연동)
- [ ] 프로덕션 배포 준비

---

## 마이그레이션 이력 (59개)

| 범위 | 파일 | 내용 |
|------|------|------|
| 기초 | 001~005 | 테이블, 함수, RLS, Storage, Seed 데이터 |
| 보안 | 006~013 | Soft Delete, RLS 수정, 알림, 인증/인가 보안 |
| 기능 | 014~019 | 반 관리, 토픽 네비게이션, 대시보드, 어드민 |
| 조직 | 020~025 | Organization 시스템, 어드민 RLS, 초대, 데이터 정리 |
| 안정화 | 026~032 | 어드민 기능, 역할 수정, 구독 정리, users RLS 수정 |
| 레거시 제거 | 033~038 | users.role 컬럼 삭제, get_user_role 재작성, 잔존 함수 수정 |
| 모의고사 | 034~041 | exam 테이블, 시드 데이터, RPC, 보안 트리거, 무결성 |
| 안정화 | 042 | admin_get_organization_detail에 org 정보 추가 (전체 목록 조회 제거) |
| Feature Gating | 043 | 서버 사이드 쿼터 검증 (_check_org_quota, use_invite_code 쿼터, scripts 트리거) |
| 통계 | 044 | get_student_practice_stats 트렌드 데이터 (prev_avg_score/rate, target_opic_grade) |
| 성능 | 045 | 시험 RPC에 audio_url 포함 (TTS 지연 근본 해결) |
| 구독 | 046 | Phase 6A: pending_plan_id, grace period, 상태 전이 트리거 |
| 구독 | 047 | Phase 6B: dunning_started_at, cancellation_feedback, 취소 리텐션 |
| 구독 | 048 | Phase 6C: billing_cycle, trial_ends_at, 연간 결제 |
| 가격 | 049 | 구독 플랜 가격 조정 (Solo 29,900/Pro 69,900/Academy 199,000) |
| 기능 | 050 | scripts.content_ko 컬럼 + content 변경 시 자동 리셋 트리거 |
| 권한 | 051 | 학생 스크립트 수정 (UPDATE RLS + 컬럼 보호 트리거) |
| 보안 | 052 | billing_key 암호화 문서화 (AES-256-GCM, Edge Function 기반) |
| 보안 | 053 | create_organization RPC 삭제 (셀프 서비스 학원 생성 보안 위험 제거) |
| 초대 | 054 | 반별 다회용 초대 코드 (class_id, max_uses, invite_uses, RPC 재작성) |
| 캐시 | 055 | PostgREST 스키마 캐시 리로드 (054 FK 인식) |
| RLS | 056 | classes ↔ class_members RLS 무한 재귀 수정 (SECURITY DEFINER 헬퍼) |
| 보안 | 057 | 조직 단위 데이터 격리 RLS 강화 (_user_org_ids 헬퍼, 6개 테이블 정책 재작성, org_members DELETE 정책) |
| 시험 | 058 | 토픽별 전략 메타데이터 |
| 구독 | 059 | 트라이얼 온보딩 (조직 생성 시 자동 Solo 14일 체험) |
| 운영 | 060 | webhook_logs + email_logs 테이블 (결제 디버깅 + 이메일 감사) |
| 온보딩 | 061 | organizations.onboarding_completed_at + get_onboarding_status/complete_onboarding RPC |
| 서베이 | 065 | OPIc 서베이 구조 재설계 (topic_groups, 토픽 재배치, 신규 토픽/질문, RPC 재작성) |
| 서베이 | 066 | set_student_topics 돌발 토픽 허용 수정 |
| 서베이 | 067 | 서베이 프로필 분리 (Q1~Q3 → student_survey_profiles, Q1~Q3 그룹 비활성화) |
| 서베이 | 068 | 공통 토픽 자동 배정 (자기소개+집/거주+이웃/동네 is_auto_assigned, set_student_topics 자동 포함) |
| 가격 | 073 | 가격 인상 (Solo 49,900/Pro 99,900/Academy 299,000), 연간 25% 할인, 트라이얼 30일, Free AI 5회/모의고사 2회 |
| 메시징 | 074 | messages + message_recipients 테이블, send_message/get_my_messages/get_sent_messages/mark_message_read RPC |

---

## 상세 문서 링크

| 문서 | 내용 |
|------|------|
| [docs/DATABASE.md](docs/DATABASE.md) | ERD, 테이블 정의, Soft Delete, RPC 원칙 |
| [docs/SECURITY.md](docs/SECURITY.md) | RLS 정책, API 키 관리, 입력값 검증 |
| [docs/FEATURES.md](docs/FEATURES.md) | 핵심 기능, 녹음 스펙, 푸시 알림, 오프라인 |
| [docs/SCREENS.md](docs/SCREENS.md) | 화면 목록, 네비게이션, 폴더 구조 |
| [docs/UX.md](docs/UX.md) | 에러 처리, 로딩 상태, 토스트 메시지 |
| [docs/TESTING.md](docs/TESTING.md) | 테스트 전략, 성능 최적화 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | 환경 분리, EAS Build, 앱스토어 |
| [docs/MONITORING.md](docs/MONITORING.md) | API 비용, 분석, 법적 요구사항 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | OPIc 시험 구조, Phase 2+ 계획 |

---

## 디버깅 팁

```typescript
// 개발 환경에서만 로그 출력 (__DEV__ 가드 필수)
if (__DEV__) {
  console.warn('[Debug]', data);
}

// Supabase 쿼리 디버깅 — console.error 금지, __DEV__ 가드 사용
const { data, error } = await supabase.from('scripts').select('*');
if (error && __DEV__) {
  console.warn('[AppError] Supabase:', error.message, error.details);
}
```

### 테스트 실행
```bash
npm test                  # 전체 테스트 실행 (428 tests)
npm test -- --coverage    # 커버리지 리포트
npm run test:watch        # 변경 감지 모드
```

---

> 📌 **이 문서는 프로젝트의 핵심 정보만 담고 있습니다.**
> 상세 내용은 docs/ 폴더의 개별 문서를 참조하세요.
