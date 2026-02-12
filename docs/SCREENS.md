# 화면 설계

> 화면 목록, 네비게이션 구조, 폴더 구조

## 화면 목록 (총 19개)

### 공통 화면 (5개)

| # | 화면 | 파일 경로 | 설명 |
|---|------|-----------|------|
| 1 | 로그인 | `app/(auth)/login.tsx` | 이메일/비밀번호 로그인 |
| 2 | 회원가입 | `app/(auth)/signup.tsx` | 역할(강사/학생) 선택 |
| 3 | 비밀번호 찾기 | `app/(auth)/forgot-password.tsx` | 이메일로 재설정 |
| 4 | 설정/프로필 | `app/(teacher)/settings.tsx` | 프로필 수정, 로그아웃 |
| 5 | 온보딩 | - | (선택) 첫 사용 안내 |

### 강사용 화면 (6개)

| # | 화면 | 파일 경로 | 설명 |
|---|------|-----------|------|
| 1 | 대시보드 | `app/(teacher)/index.tsx` | 학생 목록 |
| 2 | 학생 초대 | `app/(teacher)/invite.tsx` | 초대 코드 생성 |
| 3 | 학생 상세 | `app/(teacher)/student/[id]/index.tsx` | 스크립트/연습기록 탭 |
| 4 | 토픽 선택 | `app/(teacher)/student/script/select-topic.tsx` | 스크립트용 토픽 선택 |
| 5 | 질문 선택 | `app/(teacher)/student/script/select-question.tsx` | 스크립트용 질문 선택 |
| 6 | 스크립트 작성/수정 | `app/(teacher)/student/script/[scriptId].tsx` | 스크립트 에디터 |

### 학생용 화면 (8개)

| # | 화면 | 파일 경로 | 설명 |
|---|------|-----------|------|
| 1 | 강사 연결 | `app/(student)/connect.tsx` | 초대 코드 입력 |
| 2 | 내 토픽 설정 | `app/(student)/topics.tsx` | Background Survey |
| 3 | 대시보드 | `app/(student)/index.tsx` | 스크립트 목록 |
| 4 | 스크립트 보기 | `app/(student)/script/[id]/index.tsx` | 스크립트 확인 |
| 5 | 연습하기 | `app/(student)/script/[id]/practice.tsx` | 녹음 연습 |
| 6 | 연습 결과 | `app/(student)/script/[id]/result.tsx` | 비교 & 피드백 |
| 7 | 연습 기록 목록 | `app/(student)/history.tsx` | 전체 연습 이력 |
| 8 | 연습 기록 상세 | `app/(student)/script/practice/[practiceId].tsx` | 개별 연습 상세 |

---

## 네비게이션 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    하단 탭 네비게이션                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  강사용 탭                                                  │
│  ┌─────────┬─────────┬─────────┬─────────┐                  │
│  │   홈    │  학생   │  초대   │  설정   │                  │
│  │ (대시보드)│ (목록)  │         │         │                  │
│  └─────────┴─────────┴─────────┴─────────┘                  │
│                                                             │
│  학생용 탭                                                  │
│  ┌─────────┬─────────┬─────────┬─────────┐                  │
│  │   홈    │스크립트 │  기록   │  설정   │                  │
│  │ (대시보드)│ (목록)  │         │         │                  │
│  └─────────┴─────────┴─────────┴─────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 폴더 구조

```
opic-app/
├── app/                          ← Expo Router (파일 기반 라우팅)
│   ├── _layout.tsx               ← 루트 레이아웃
│   ├── index.tsx                 ← 시작 화면 (로그인 체크)
│   │
│   ├── (auth)/                   ← 인증 관련
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   │
│   ├── (teacher)/                ← 강사용 화면
│   │   ├── _layout.tsx           ← 강사용 탭 네비게이션
│   │   ├── index.tsx             ← 대시보드
│   │   ├── invite.tsx            ← 학생 초대
│   │   ├── settings.tsx          ← 설정
│   │   └── student/
│   │       ├── [id]/
│   │       │   ├── index.tsx     ← 학생 상세
│   │       │   └── practice/
│   │       │       └── [practiceId].tsx
│   │       └── script/
│   │           ├── select-topic.tsx
│   │           ├── select-question.tsx
│   │           ├── new.tsx
│   │           └── [scriptId].tsx
│   │
│   ├── (student)/                ← 학생용 화면
│   │   ├── _layout.tsx           ← 학생용 탭 네비게이션
│   │   ├── index.tsx             ← 대시보드
│   │   ├── connect.tsx           ← 강사 연결
│   │   ├── topics.tsx            ← 내 토픽 설정
│   │   ├── history.tsx           ← 연습 기록 목록
│   │   ├── settings.tsx          ← 설정
│   │   └── script/
│   │       ├── [id]/
│   │       │   ├── index.tsx     ← 스크립트 보기
│   │       │   ├── practice.tsx  ← 연습하기
│   │       │   └── result.tsx    ← 연습 결과
│   │       └── practice/
│   │           └── [practiceId].tsx
│   │
│   └── +not-found.tsx
│
├── components/                   ← 재사용 컴포넌트
│   ├── ui/                       ← 기본 UI
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Loading.tsx
│   │   ├── EmptyState.tsx
│   │   └── Badge.tsx
│   │
│   ├── layout/                   ← 레이아웃
│   │   ├── TabBar.tsx
│   │   ├── Header.tsx
│   │   └── SafeAreaView.tsx
│   │
│   ├── auth/                     ← 인증 관련
│   │   ├── AuthGuard.tsx
│   │   └── RoleGuard.tsx
│   │
│   ├── teacher/                  ← 강사용
│   │   ├── StudentCard.tsx
│   │   ├── ScriptEditor.tsx
│   │   ├── FeedbackForm.tsx
│   │   └── InviteCodeCard.tsx
│   │
│   ├── student/                  ← 학생용
│   │   ├── ScriptCard.tsx
│   │   ├── PracticeCard.tsx
│   │   ├── TopicSelector.tsx
│   │   └── ProgressBar.tsx
│   │
│   └── practice/                 ← 연습 관련
│       ├── AudioPlayer.tsx
│       ├── AudioRecorder.tsx
│       ├── RecordingTimer.tsx
│       ├── TranscriptCompare.tsx
│       ├── FeedbackDisplay.tsx
│       └── ScoreDisplay.tsx
│
├── lib/                          ← 유틸리티 & 설정
│   ├── supabase.ts
│   ├── constants.ts
│   ├── helpers.ts
│   ├── types.ts
│   └── validation.ts
│
├── services/                     ← API 서비스
│   ├── auth.ts
│   ├── users.ts
│   ├── invites.ts
│   ├── topics.ts
│   ├── questions.ts
│   ├── scripts.ts
│   ├── practices.ts
│   ├── whisper.ts
│   ├── tts.ts
│   ├── feedback.ts
│   └── storage.ts
│
├── hooks/                        ← 커스텀 훅
│   ├── useAuth.ts
│   ├── useUser.ts
│   ├── useRecorder.ts
│   ├── useAudioPlayer.ts
│   └── useSupabase.ts
│
├── stores/                       ← 상태 관리 (Zustand)
│   ├── authStore.ts
│   ├── userStore.ts
│   └── practiceStore.ts
│
├── assets/                       ← 정적 파일
│   ├── images/
│   └── fonts/
│
└── supabase/                     ← Supabase 설정
    ├── migrations/
    ├── functions/
    │   ├── whisper-stt/
    │   ├── claude-feedback/
    │   └── delete-user/
    └── config.toml
```
