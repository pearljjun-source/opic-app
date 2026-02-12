# 데이터베이스 설계

> 상세 ERD, 테이블 정의, RLS 정책, Soft Delete 규칙

## 테이블 목록 (14개)

```
┌─────────────────────────────────────────────────────────────┐
│                    데이터베이스 구조                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👤 users              ← 사용자 (강사/학생)                  │
│      │                   + push_token (푸시 알림)           │
│      │                                                      │
│      ├── 🎫 invites           ← 초대 코드 관리              │
│      ├── 🔗 teacher_student   ← 강사-학생 연결              │
│      ├── 📝 student_topics    ← 학생 토픽 선택              │
│      ├── ✅ user_consents     ← 사용자 동의 기록            │
│      └── 📊 api_usage         ← API 사용량 추적             │
│                                                             │
│  📚 topics             ← 토픽 (문제은행)                    │
│      └── ❓ questions         ← 질문 (문제은행)             │
│              └── 📄 scripts   ← 스크립트                    │
│                      ├── 👁️ script_views  ← 조회 기록       │
│                      └── 🎤 practices     ← 연습 기록       │
│                              └── 💬 teacher_feedbacks       │
│                                                             │
│  ⚙️ app_config         ← 앱 설정                            │
│  🔔 notification_logs  ← 알림 로그                          │
└─────────────────────────────────────────────────────────────┘
```

## ERD (Entity Relationship Diagram)

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│   users     │       │ teacher_student │       │   invites   │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │──┐    │ id (PK)         │   ┌───│ id (PK)     │
│ email       │  │    │ teacher_id (FK) │◀──┤   │ teacher_id  │
│ name        │  │    │ student_id (FK) │◀──┤   │ code        │
│ role        │  │    │ created_at      │   │   │ status      │
│ push_token  │  │    │ deleted_at      │   │   │ used_by     │
│ created_at  │  │    └─────────────────┘   │   │ expires_at  │
│ deleted_at  │  │                          │   └─────────────┘
└─────────────┘  │    ┌─────────────────┐   │
       ▲         └───▶│ student_topics  │   │
       │              ├─────────────────┤   │
       │              │ student_id (FK) │◀──┘
       │              │ topic_id (FK)   │◀──────┐
       │              └─────────────────┘       │
       │                                        │
┌──────┴──────┐       ┌─────────────────┐       │
│   topics    │       │   questions     │       │
├─────────────┤       ├─────────────────┤       │
│ id (PK)     │◀──────│ topic_id (FK)   │◀──────┘
│ name_ko     │       │ question_text   │
│ name_en     │       │ question_type   │
│ is_active   │       │ audio_url       │ ← TTS 캐싱
└─────────────┘       └────────┬────────┘
                               │
                               ▼
              ┌─────────────────────────────────┐
              │             scripts             │
              ├─────────────────────────────────┤
              │ id (PK)                         │
              │ student_id (FK) → users         │
              │ question_id (FK) → questions    │
              │ teacher_id (FK) → users         │
              │ content, comment, status        │
              │ deleted_at                      │
              └──────────────┬──────────────────┘
                             │
                     ┌───────┴───────┐
                     ▼               ▼
              ┌──────────────┐  ┌────────────────────┐
              │ script_views │  │     practices      │
              ├──────────────┤  ├────────────────────┤
              │ script_id    │  │ student_id (FK)    │
              │ viewed_at    │  │ script_id (FK)     │
              │ deleted_at   │  │ audio_url          │
              └──────────────┘  │ transcription      │
                                │ score, feedback    │
                                │ deleted_at         │
                                └─────────┬──────────┘
                                          │
                                          ▼
                                ┌────────────────────┐
                                │ teacher_feedbacks  │
                                ├────────────────────┤
                                │ practice_id (FK)   │
                                │ teacher_id (FK)    │
                                │ feedback           │
                                │ deleted_at         │
                                └────────────────────┘
```

## Soft Delete 정책

### 적용 테이블 (10개)
- users, invites, teacher_student, student_topics
- scripts, script_views, practices, teacher_feedbacks
- user_consents, notification_logs

### 미적용 테이블 (4개 - 시스템 데이터)
- topics, questions, app_config, api_usage

### 핵심 원칙
1. 삭제 시 `deleted_at = NOW()` 설정 (실제 삭제 안 함)
2. 모든 SELECT 쿼리에 `deleted_at IS NULL` 조건 적용
3. 복구 가능 (`deleted_at = NULL`로 되돌리기)

### Soft Delete 함수
```sql
soft_delete_user(user_id)
soft_delete_script(script_id)
soft_delete_connection(connection_id)
soft_delete_student_topic(student_topic_id)
```

## RPC 함수 설계 원칙

### 원칙 1: 복잡한 데이터 집계는 서버에서 처리
```typescript
// ❌ N+1 쿼리 (클라이언트)
const students = await getStudents();     // 1 쿼리
for (const s of students) {
  await getScripts(s.id);                 // N 쿼리
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

| 함수 | 용도 |
|------|------|
| `get_user_role` | 사용자 역할 조회 |
| `get_teacher_students` | 강사의 학생 목록 + 통계 |
| `create_invite` | 초대 코드 생성 |
| `use_invite_code` | 초대 코드 사용 |
| `get_student_practice_stats` | 학생 연습 통계 |
| `soft_delete_*` | Soft Delete 함수들 |

## 추가 테이블 SQL

```sql
-- 스크립트 조회 기록
CREATE TABLE public.script_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- 강사 피드백
CREATE TABLE public.teacher_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feedback text NOT NULL,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- 사용자 동의 기록
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  terms_agreed boolean DEFAULT false,
  terms_agreed_at timestamptz,
  privacy_agreed boolean DEFAULT false,
  privacy_agreed_at timestamptz,
  voice_data_agreed boolean DEFAULT false,
  voice_data_agreed_at timestamptz,
  marketing_agreed boolean DEFAULT false,
  marketing_agreed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- 앱 설정
CREATE TABLE public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- API 사용량 추적
CREATE TABLE public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  api_type text NOT NULL,
  tokens_used int,
  duration_ms int,
  called_at timestamptz DEFAULT now()
);

-- 푸시 알림 로그
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  sent_at timestamptz DEFAULT now(),
  read_at timestamptz,
  deleted_at timestamptz
);
```
