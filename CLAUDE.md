# OPIc 학습 앱 - 프로젝트 설계 문서

> **문서 버전**: v2.0 (분리됨)
> **최종 수정일**: 2026-02-07
> **작성자**: Jin (영어 강사) + Claude AI

---

## 프로젝트 개요

영어 강사 Jin이 학생들과 OPIc 수업 진행 시 사용할 학습 앱.
실제 OPIc 시험의 가상 진행자 "Ava"를 시뮬레이션하고, 스크립트 기반 연습 및 AI 피드백을 제공.

### 핵심 가치
- **강사-학생 연계**: 강사가 학생별 맞춤 스크립트 작성
- **실전 연습**: Ava 음성으로 질문 듣고 녹음 연습
- **AI 피드백**: 스크립트 vs 실제 답변 비교 분석
- **학습 기록**: 연습 이력 관리 및 진도 추적

### 대상 사용자
| 구분 | 설명 |
|------|------|
| 강사 (Teacher) | Jin - OPIc 수업 진행, 스크립트 작성 |
| 학생 (Student) | Jin의 수업을 듣는 학생들 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React Native + Expo (SDK 52+), Expo Router, NativeWind, Zustand |
| 백엔드 | Supabase (Auth, PostgreSQL, Storage, Edge Functions) |
| AI & 음성 | Whisper API (STT), OpenAI TTS, Claude Haiku |
| 배포 | EAS Build, Google Play, Vercel (웹) |

---

## 상수 정의 (lib/constants.ts)

```typescript
export const USER_ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

export const INVITE_STATUS = {
  PENDING: 'pending',
  USED: 'used',
  EXPIRED: 'expired',
} as const;

export const SCRIPT_STATUS = {
  DRAFT: 'draft',
  COMPLETE: 'complete',
} as const;

export const QUESTION_TYPES = {
  DESCRIBE: 'describe',
  ROUTINE: 'routine',
  EXPERIENCE: 'experience',
  COMPARISON: 'comparison',
  ROLEPLAY: 'roleplay',
  ADVANCED: 'advanced',
} as const;

export const COLORS = {
  PRIMARY: '#3B82F6',
  SECONDARY: '#10B981',
  WARNING: '#F59E0B',
  ERROR: '#EF4444',
  GRAY: '#6B7280',
  WHITE: '#FFFFFF',
  TEXT_PRIMARY: '#111827',
  TEXT_SECONDARY: '#6B7280',
  BACKGROUND_SECONDARY: '#F9FAFB',
} as const;
```

---

## 권한 매트릭스 요약

**범례**: ✅ 가능 | ❌ 불가 | 🔸 조건부

| 테이블 | teacher | student | 조건 |
|--------|:-------:|:-------:|------|
| scripts | 🔸 | 🔸 | teacher: 본인 작성 / student: 본인 것 |
| practices | 🔸 | 🔸 | teacher: 연결된 학생 / student: 본인 |
| invites | 🔸 | 🔸 | teacher: 본인 것 / student: 코드 사용 |
| topics, questions | ✅ | ✅ | 공개 (읽기 전용) |

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

---

## 보안 핵심 원칙

> **근본 원인: 서버가 클라이언트 입력을 신뢰하는 패턴**
> **원칙: 권한 있는 작업은 반드시 서버에서 결정/검증**

### 적용된 보안 패턴

| 위협 | 근본 해결책 | 구현 (012_auth_security.sql) |
|------|------------|------------------------------|
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

### 보호 컬럼 트리거 bypass 원리 (PostgreSQL 내장 역할 시스템)
```sql
-- protect_user_columns 트리거 내부:
-- 일반 클라이언트 (authenticated/anon) → 보호 컬럼 변경 차단
-- SECURITY DEFINER 함수 (current_user = postgres) → 신뢰된 서버 코드, 자동 bypass
IF current_user NOT IN ('authenticated', 'anon') THEN
  RETURN NEW;  -- 세션 변수 불필요, PostgreSQL 역할 시스템에 의존
END IF;
```

### 회원가입 플로우
```
클라이언트 → signUp(email, password, name)  ← role 전달 금지
   ↓
auth.users 생성 → handle_new_user 트리거 → public.users INSERT (role='student' 강제)
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

```sql
-- CAS 패턴 예시 (use_invite_code)
UPDATE invites SET status = 'used'
WHERE id = v_invite.id AND status = 'pending';  -- 확인+변경 원자적
GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
IF v_rows_affected = 0 THEN  -- 다른 트랜잭션이 먼저 변경
  RETURN 'CODE_ALREADY_USED';
END IF;

-- UNIQUE + ON CONFLICT 패턴 예시 (notify_action)
INSERT INTO notification_logs (type, user_id, ..., resource_id)
VALUES (p_type, v_recipient_id, ..., p_resource_id)
ON CONFLICT (type, user_id, resource_id) WHERE deleted_at IS NULL
DO NOTHING
RETURNING id INTO v_notification_id;  -- NULL이면 이미 존재
```

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

### 현재 RPC 함수 목록
| 함수 | 용도 | 마이그레이션 |
|------|------|-------------|
| `get_user_role` | 사용자 역할 조회 | |
| `get_teacher_students` | 강사의 학생 목록 + 통계 | |
| `is_connected_student` | 연결 여부 확인 | |
| `create_invite` | 초대 코드 생성 | |
| `use_invite_code` | 초대 코드 사용 + 알림 생성 (CAS 패턴) | 011, 013 |
| `soft_delete_*` | Soft Delete 함수들 | |
| `soft_delete_invite` | 초대 코드 삭제 (강사 소유권 검증) | 013 |
| `notify_action` | 알림 생성 (SECURITY DEFINER, 서버 결정 수신자, resource_id UNIQUE 중복 방지) | 011, 013 |
| `promote_to_teacher` | admin 전용 강사 승격 | 012 |
| `get_student_practice_stats` | 학생 연습 통계 (본인/연결 강사만) | 002, 013 |

---

## Phase 1 개발 체크리스트

### 완료됨 ✅
- [x] 프로젝트 초기 설정
- [x] Supabase 설정 (테이블, RLS)
- [x] 공통 컴포넌트 & 유틸리티
- [x] 인증 기능
- [x] 강사 대시보드 (학생 목록)
- [x] 학생 상세 화면
- [x] 스크립트 CRUD
- [x] 초대 코드 검증
- [x] 학생 기능
- [x] 녹음 & 오디오 기능
- [x] AI 연동
- [x] 푸시 알림 (011_notification_rpc, deliver-notification)
- [x] 인증/보안 근본 수정 (012_auth_security)
- [x] 인가 검증 + 데이터 무결성 (013_authorization_fixes)

### 완료됨 ✅ (추가)
- [x] 에러 처리 & UX 개선 (lib/errors.ts: 53 에러코드, classifyError, 서비스/화면 전체 통합)

### 진행 중 🚧
- [ ] 테스트 & QA (자동화 테스트 336개 통과 — validation 146, errors 129, services 61)

### 예정 📋
- [ ] 배포 준비

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
npm test                  # 전체 테스트 실행 (336 tests)
npm test -- --coverage    # 커버리지 리포트
npm run test:watch        # 변경 감지 모드
```

---

> 📌 **이 문서는 프로젝트의 핵심 정보만 담고 있습니다.**
> 상세 내용은 docs/ 폴더의 개별 문서를 참조하세요.
