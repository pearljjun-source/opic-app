# Speaky OPIc App - TODO

> 최종 업데이트: 2026-09-02

---

## 지금 해야 할 것

### 1. 브랜치 머지 + 푸시
현재 작업은 `work/exam-fixes-and-tests` 브랜치에 커밋 5개로 있다 (master 기준 fast-forward).

```bash
git checkout master
git merge work/exam-fixes-and-tests
git push
```

| 커밋 | 내용 |
|------|------|
| `f6f21d5` | fix: 시험 자동 모드(CBT) 진행 불가 문제 |
| `902d849` | feat: OPIc 핵심 표현 라이브러리 |
| `9eddeb5` | fix: 토픽 배정이 풀리면 스크립트에 도달할 수 없었다 |
| `9a1f14a` | test: 문자열 대조 테스트를 실행 테스트로 교체 |
| `750fbf2` | ci: 스키마 드리프트 검사 + GitHub Actions |

### 2. CI 시크릿 등록
푸시 후 https://github.com/pearljjun-source/opic-app/settings/secrets/actions

- Name: `SUPABASE_ACCESS_TOKEN` (Supabase 대시보드에서 새로 발급)
- ⚠️ 발급한 토큰을 파일이나 명령줄에 남기지 말 것 (PowerShell 명령 기록에 남는다)
- 등록 전까지 `schema-drift` 잡은 실패한다. `test` 잡은 시크릿 없이 동작

### 3. Supabase 프로젝트 정리
`Homepage` 조직에 프로젝트가 2개다.

- `opic-app` (`nnneyjvcbevwmsvvundr`) — **실제 사용 중**. 유지
- `speaky-prod` — paused 상태, 코드 어디에서도 참조하지 않음. 삭제 대상
- 삭제 전 Reference ID로 한 번 더 확인할 것 (삭제는 되돌릴 수 없다)

### 4. 김하진 학생 계정 중복 정리
같은 이름으로 계정이 2개다. 어느 쪽이 실제 사용 계정인지 확인 후 정리 필요.

| 이메일 | 스크립트 | 배정 토픽 |
|--------|---------:|---------:|
| `gdayenglishstudio@gmail.com` | 0 | 0 |
| `onthego@gmail.com` | 3 | 4 |

---

## 완료 (2026-09-02 세션)

### 시험 자동 모드 정지 문제 2건
- [x] **음성 동의 데드락** — `prep_countdown`은 early return으로 별도 화면을 그리는데
  `VoiceConsentModal`은 최종 return에만 있어, "답변 준비 0"에서 멈췄다.
  첫 시험을 보는 모든 학생이 걸리는 문제였다
  - 오리엔테이션에서 시험 시작 전에 동의를 받도록 변경
  - 세션 쪽 `consentStatus` 조회 지연 경합도 함께 해결 (effect 의존성 추가)
- [x] **TTS 실패 시 무한 재시도** — 실패하면 상태가 `ready`로 돌아가 0.5초마다 재시도.
  알림이 쌓이고 TTS 쿼터(50/시간)가 25초면 소진됐다
  - 문항별 실패 기록(`ttsFailedRef`)으로 1회만 시도, 실패 시 음성 없이 진행
- [x] `orientation` 라우트를 `exam/_layout.tsx`에 등록 (헤더 제목이 "orientation"으로 떴음)

### 토픽 배정 해제 시 스크립트 유실 (079)
- [x] `get_student_topics_with_progress`를 "배정 토픽 ∪ 스크립트 보유 토픽"으로 재작성
- [x] `is_assigned` 플래그 + "스크립트 보관" 뱃지
- [x] 스크립트 있는 토픽 해제 시 확인 창 (학생 서베이 / 강사 배정 양쪽)
- [x] `get_student_topic_script_counts` RPC 추가

### 078 보안 수정 (적용 전 발견)
- [x] `get_expressions`를 `SECURITY DEFINER` → `INVOKER` (타 조직 표현 열람 가능했음)
- [x] UPDATE 정책에 `WITH CHECK` 추가 (`organization_id` 바꿔치기 차단)
- [x] 트리거 함수명 `_update_timestamp` → `_expressions_set_updated_at` (동명 함수 덮어쓰기 위험)
- [x] 강사 화면 `Alert.alert` → `lib/alert` (웹에서 무반응이었음)
- [x] `handleCloneAll` 에러 표시 (조용히 실패하고 있었음)

### 마이그레이션 적용
- [x] 078, 079 적용
- [x] **060, 061, 076, 077 적용** — 파일에만 있고 DB에 없던 것들.
  076/077은 이미 배포된 코드가 호출하고 있었고, 059는 트라이얼 만료 함수가 없어
  체험이 끝나지 않고 있었다
- [x] 059는 `expire_trial_subscriptions`만 부분 적용.
  ⚠️ `create_trial_subscription`은 073에서 30일로 재작성됐으므로 059를 통째로
  재실행하면 14일로 회귀한다

### 테스트 전환 (로드맵 1단계, 6개 중 3개)
- [x] `payment-callback` (텍스트 단언 73개 → 실행 37개)
- [x] `web-practice-flow` (56개 → 실행 38개), `practices.ts` 커버리지 1.81% → 43.6%
- [x] `web-security` (34개 → 실행 13개). signOut 테스트 2개는 자기 조건문을 검증하는
  항진(tautology)이었다
- [x] 테스트 가능하도록 추출: `parsePaymentCallbackParams`(lib/toss.ts),
  `purgeSupabaseAuthTokens`(lib/auth-session.ts)
- [x] 각 파일마다 코드를 일부러 깨뜨려 테스트가 반응하는지 확인

### 스키마 드리프트 검사 (로드맵 1.5단계)
- [x] `scripts/schema-drift.js` + `npm run check:schema`
- [x] 파서/비교기 테스트 15개
- [x] GitHub Actions 워크플로 (`test` 잡: 모든 push/PR, `schema-drift` 잡: 매일 + 수동)

### 문서
- [x] CLAUDE.md에 상위 가이드라인(`JIN_APP_GUIDELINES.md`) 연결 + 미준수 원칙 표
- [x] CLAUDE.md 테스트 로드맵 + `CREATE OR REPLACE` 재적용 주의
- [x] docs/TESTING.md에 "문서상 목표 vs 실제" 경고 추가
- [x] 사용설명서 v1.1 (오리엔테이션 동의, 스크립트 보관, TTS 실패 시 진행)

### 검증
- [x] TypeScript 0 에러 / 테스트 862개 통과 / 스키마 드리프트 0건

---

## 진행 중 — 테스트 로드맵

CLAUDE.md "테스트 로드맵" 참조.

### 1단계: 문자열 대조 → 실행 테스트 (3/6)
- [ ] `services/messages` (텍스트 단언 19개) — 074 SQL 대조는 `check:schema`가 대신하므로 걷어낸다
- [ ] `billing/subscription-phase6a/b/c` (~18개)
- [ ] `billing/quota-enforcement`, `billing/trend-data` (~6개)

### 2단계: 커버리지 0% 서비스
- [ ] `topics.ts` (0%)
- [ ] `students.ts`, `classes.ts`, `organizations.ts`, `admin.ts`, `notifications.ts`, `landing.ts` (전부 0%)

### 3단계: 컴포넌트 테스트
- [ ] `@testing-library/react-native` 도입
- [ ] `exam/session.tsx` 상태 전이 (데드락·TTS 루프가 여기서 잡혔을 문제)
- [ ] `exam/orientation.tsx` 동의 게이트 + 카운트다운

### 4단계: E2E
- [ ] Maestro 도입 (Expo와 궁합이 좋고 네이티브 빌드 불필요)
- [ ] 로그인 → 토픽 → 스크립트 → 녹음 1개 플로우

---

## 가이드라인 미준수 (CLAUDE.md 기록)

`JIN_APP_GUIDELINES.md` 기준으로 아직 안 지켜진 것들.

- [ ] **A21 접근성** — `accessibilityLabel` 사용 0건. 라벨 연결·색 의존·대비 4.5:1·터치 24px
- [ ] **A8 시간대** — 통계·스트릭 집계 기준 시간대 명문화
- [ ] **A9 개인정보/PII** — 음성 녹음·STT 텍스트 보관 기간과 삭제 경로 명문화
- [ ] **A19 배포 전 체크리스트** — 가이드라인 A19를 그대로 사용

> A13(`void fn()`)은 2026-09-02 확인 결과 **해당 없음**. `services/scripts.ts`의
> fire-and-forget은 클라이언트에서 돌고 복구 경로가 있다(진입 시 그 자리에서 번역/TTS 생성).

---

## 로드맵 (미착수)

### Phase E — Universal Links / App Links
- [ ] 딥링크 설정 (speaky.co.kr → 앱 연결), EAS 빌드 필요

### 세금계산서 자동 발급
- [ ] 팝빌/바로빌 API 연동

### 프로덕션 배포 준비
- [ ] Google Play / App Store 등록
- [ ] 프로덕션 환경 변수, Sentry DSN, Mixpanel 토큰

---

## 기술 부채

- [ ] `supabase/functions/_shared/constants.ts` 변경 잔여 (이전 세션)
- [ ] `fromTable` 헬퍼 — `supabase gen types`로 신규 테이블 타입 재생성하면 제거 가능
      (078의 `expressions`, `expression_categories`가 대상)
- [ ] Jest worker 강제 종료 경고 (타이머 leak) 조사
- [ ] 스키마 드리프트 검사가 **객체 존재만** 본다. 059처럼 "객체는 있는데 내용이 옛 버전"은
      못 잡는다. 필요해지면 함수 본문 해시 비교 추가
