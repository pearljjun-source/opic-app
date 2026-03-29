# Speaky — OPIc 학습 SaaS 플랫폼

> **문서 버전**: v5.0
> **최종 수정일**: 2026-03-26
> **작성자**: Jin + Claude AI

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
│   └── (tabs)/      # 4탭: index, classes, invite, settings
├── (student)/       # 학생: 연습, 이력, 토픽, 연결
│   └── (tabs)/      # 3탭: index, history, settings
├── join/[code].tsx   # 공개 초대 링크 (speaky.co.kr/join/CODE)
└── index.tsx        # 랜딩 페이지 (미인증) / 홈 리다이렉트 (인증)

services/            # 12개 서비스 (admin, billing, classes, connection, invites,
                     #   landing, notifications, organizations, practices, scripts,
                     #   students, topics)
hooks/               # 7개 훅 (useAuth, useSubscription, useTheme,
                     #   usePushNotifications, useAppState, useNetworkStatus)
lib/                 # errors.ts, types.ts, constants.ts, validations.ts, supabase.ts
supabase/
├── functions/       # 8개 Edge Functions + _shared
└── migrations/      # 32개 마이그레이션 (001~032)
```

---

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

// 설정
APP_CONFIG.API_RATE_LIMIT  // whisper: 30/h, claude: 50/h, tts: 20/h
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
| `tts-generate` | OpenAI TTS | 20/시간 | 캐시 히트 후 체크 (캐시 시 미소비) |
| `claude-feedback` | Claude API | 50/시간 | |

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

### 예정 📋
- [ ] Universal Links / App Links (Phase E — 별도 EAS 빌드 필요)
- [ ] 세금계산서 자동 발급 (팝빌/바로빌 API 연동)
- [ ] 프로덕션 배포 준비

---

## 마이그레이션 이력 (53개)

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
