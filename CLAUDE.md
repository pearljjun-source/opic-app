# Speaky — OPIc 학습 SaaS 플랫폼

> **문서 버전**: v4.0
> **최종 수정일**: 2026-03-08
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
├── (auth)/          # 인증: login, signup, verify-email, confirm, forgot-password, create-academy
├── (admin)/         # 슈퍼 관리자: 대시보드, 학원/사용자/구독/랜딩 관리
│   └── (tabs)/      # 6탭: index, landing, academies, users, billing, settings
├── (teacher)/       # 강사: 대시보드, 학생/반/스크립트/초대/구독 관리
│   └── (tabs)/      # 4탭: index, classes, invite, settings
├── (student)/       # 학생: 연습, 이력, 토픽, 연결
│   └── (tabs)/      # 3탭: index, history, settings
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
| scripts | 🔸 | 🔸 | 🔸 | 🔸 | teacher: 본인 작성 / student: 본인 것 |
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
| `create_organization` | 조직 생성 |
| `get_my_organizations` | 내 조직 목록 |
| `get_org_teachers` | 조직 강사 목록 |
| `remove_org_member` | 멤버 제거 (SECURITY DEFINER) |
| `change_member_role` | 역할 변경 |
| `update_organization_name` | 조직명 변경 |

**초대/연결**:
| 함수 | 용도 |
|------|------|
| `create_invite` | 초대 코드 생성 (조직 기반) |
| `use_invite_code` | 초대 코드 사용 (CAS 패턴 + SECURITY DEFINER) |
| `soft_delete_invite` | 초대 삭제 (소유권 검증) |

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

## Edge Functions (12개)

| 함수 | 용도 | 외부 API |
|------|------|---------|
| `whisper-stt` | 음성 → 텍스트 변환 | OpenAI Whisper |
| `tts-generate` | 텍스트 → 음성 변환 | OpenAI TTS |
| `claude-feedback` | AI 피드백 생성 (스크립트 연습) | Claude Haiku |
| `claude-exam-evaluate` | 모의고사 AI 평가 (ACTFL 4차원 채점) | Claude Haiku |
| `deliver-notification` | 푸시 알림 배달 | Expo Push |
| `billing-key` | TOSS 빌링키 발급 | TOSS Payments |
| `toss-webhook` | 결제 웹훅 처리 | TOSS Payments |
| `subscription-renew` | 구독 자동 갱신 | TOSS Payments |
| `delete-user` | 사용자 데이터 삭제 | — |
| `update-billing-key` | 결제 수단 변경 (빌링키 재발급) | TOSS Payments |
| `change-plan` | 플랜 업/다운그레이드 (proration) | TOSS Payments |

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

### 예정 📋
- [ ] Phase 6B: Dunning 이메일 시퀀스 + 취소 리텐션 플로우
- [ ] Phase 6C: 연간 결제 + 트라이얼 전환 넛지
- [ ] 프로덕션 배포 준비

---

## 마이그레이션 이력 (46개)

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
