# OPIc 시험 정보 & 향후 로드맵

> OPIc 시험 구조, Phase 별 로드맵, 마이그레이션 가이드

## OPIc 시험 구조

### 시험 진행 4단계

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. Background│ → │ 2. Self-    │ → │ 3. 오리엔   │ → │ 4. 본시험   │
│    Survey   │    │  Assessment │    │    테이션   │    │  (12~15문항)│
│ (12개 토픽) │    │ (난이도선택)│    │             │    │   40분      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 질문 유형 (Question Types)

| 유형 | 영문 | 설명 | 예시 |
|------|------|------|------|
| 묘사/설명 | describe | 장소, 사물, 사람 묘사 | "집 묘사해줘" |
| 루틴 | routine | 일상적인 활동 | "보통 주말에 뭐해?" |
| 과거 경험 | experience | 과거 특정 경험 | "기억에 남는 여행?" |
| 비교 | comparison | 과거와 현재 비교 | "어릴 때 vs 지금 취미" |
| 롤플레이 | roleplay | 상황극 (3콤보) | "호텔 예약 상황" |
| 어드밴스 | advanced | 의견/해결책 제시 | "환경문제 해결방안?" |

### OPIc 등급 체계

```
Novice (초급)
├── NL (Novice Low)
├── NM (Novice Mid)
└── NH (Novice High)

Intermediate (중급)
├── IL (Intermediate Low)
├── IM1 (Intermediate Mid 1)
├── IM2 (Intermediate Mid 2)
├── IM3 (Intermediate Mid 3)
└── IH (Intermediate High)

Advanced (고급)
└── AL (Advanced Low)
```

### 평가 기준

| 기준 | 설명 |
|------|------|
| Function | 언어 기능 수행 능력 |
| Accuracy | 문법, 어휘, 발음 정확성 |
| Content/Context | 내용의 적절성 |
| Text Type | 문장 구성 복잡도 |

---

## Phase 별 로드맵

### Phase 1: Jin 수업용 (현재)
- 강사-학생 연결
- 스크립트 작성/관리
- 녹음 연습 + AI 피드백
- 기본 푸시 알림

### Phase 2: 혼자 학습 (3~6개월 후)
- 학생 혼자 토픽/질문 선택
- AI가 스크립트 생성 (강사 없이)
- 학습 통계 대시보드
- 다크모드 지원
- 앱 리뷰 요청 기능

### Phase 3: 롤플레이 + 모의고사 (6~12개월 후)
- 3콤보 롤플레이 시뮬레이션
- 실제 시험과 동일한 모의고사
- AI 실시간 대화 (Claude 활용)
- 상세 성적 분석 리포트

### Phase 4: 확장 (12개월 후~)
- 다른 강사 가입
- 일반 사용자 구독 서비스
- iOS 앱 출시
- 다국어 지원 (영어)
- B2B (학원, 기업)

---

## Phase 1에서 미리 준비할 것

### 다국어 지원 대비
- 모든 UI 텍스트를 lib/strings.ts에 모아두기
- 하드코딩 금지: "로그인" ❌
- 상수 사용: STRINGS.LOGIN ✅

```typescript
// lib/strings.ts
export const STRINGS = {
  LOGIN: '로그인',
  SIGNUP: '회원가입',
  PRACTICE_START: '연습 시작',
  // ...
};
```

### 다크모드 대비
- 색상값 하드코딩 피하기
- lib/constants.ts의 COLORS 상수 사용
- NativeWind 사용 시 dark: 클래스로 쉽게 지원

```typescript
// 상수 사용
<Text style={{ color: COLORS.TEXT_PRIMARY }}>

// NativeWind
<Text className="text-gray-900 dark:text-white">
```

### 컴포넌트 재사용성
- 공통 UI는 components/ui/에 만들기
- Props로 커스터마이징 가능하게
- Phase 2에서 디자인 변경 시 한 곳만 수정

---

## Phase 2+ 기능 목록 (참고용)

### 기능
- 다국어 지원 (i18n) - 영어 버전
- 다크모드
- 앱 리뷰 요청 (인앱 리뷰)
- 소셜 로그인 (Google, Apple, Kakao)
- 학습 통계 & 그래프
- 뱃지/성취 시스템 (게이미피케이션)
- 오프라인 모드 강화

### 보안 (고급)
- SSL Pinning
- 루팅/탈옥 감지
- 스크린 캡처 방지

### 접근성
- 스크린 리더 지원
- 고대비 모드
- 큰 글씨 모드

### 개발 효율
- CI/CD 파이프라인 (GitHub Actions)
- 자동 테스트 (E2E with Detox)
- A/B 테스트 (기능 플래그)
- 코드 푸시 (OTA 업데이트)

> Phase 1에서는 위 기능들 신경 쓰지 않아도 됨!
> 단, "미리 준비할 것"만 지키면 나중에 추가 쉬움

---

## Phase 4 마이그레이션 가이드

> **중요**: Phase 4는 단순한 기능 추가가 아닌 **구조적 변경**이 필요합니다.
> 현재 ERD는 "강사-학생 직접 연결" 구조이며, Phase 4는 "조직-강사-학생 계층 구조"가 필요합니다.

### 현재 구조 (Phase 1~3)

```
users (강사/학생 동일 테이블)
  │
  ├── teacher_student (직접 연결)
  │     teacher_id ──→ users.id
  │     student_id ──→ users.id
  │
  ├── scripts
  │     teacher_id ──→ users.id
  │     student_id ──→ users.id
  │
  └── practices
        student_id ──→ users.id
```

### Phase 4 목표 구조

```
organizations (학원/기관)
  │
  └── organization_members (조직-사용자 연결)
        organization_id ──→ organizations.id
        user_id ──→ users.id
        role (admin/teacher/student)

users
  │
  ├── teacher_student
  │     + organization_id ← 어느 조직에서의 연결인지
  │
  ├── scripts
  │     + organization_id ← 어느 조직의 스크립트인지
  │
  └── practices
        (scripts 통해 조직 추적)
```

### 마이그레이션 체크리스트

#### 새 테이블 생성
- [ ] organizations 테이블 (id, name, description, created_at, deleted_at)
- [ ] organization_members 테이블 (id, organization_id, user_id, role, created_at)

#### 기존 테이블 수정
- [ ] teacher_student에 organization_id 컬럼 추가
- [ ] scripts에 organization_id 컬럼 추가
- [ ] invites에 organization_id 컬럼 추가

#### RLS 정책 전체 재작성
- [ ] 모든 테이블에 조직 기반 검증 추가
- [ ] admin 역할: 조직 내 전체 조회 권한
- [ ] 강사: 같은 조직 내 연결된 학생만
- [ ] 학생: 본인 데이터만

#### 기존 데이터 마이그레이션
- [ ] 기본 organization 생성 ("Jin's Academy")
- [ ] 모든 기존 사용자를 기본 조직에 할당
- [ ] teacher_student에 기본 organization_id 할당
- [ ] scripts에 기본 organization_id 할당

#### 새 화면 개발
- [ ] 조직 관리 화면 (admin용)
- [ ] 조직 멤버 관리 화면
- [ ] 조직 전환 UI (다중 조직 소속 시)

### 주의사항

| 항목 | 설명 |
|------|------|
| 하위 호환성 | 마이그레이션 중 서비스 중단 최소화 |
| 롤백 계획 | 문제 발생 시 이전 상태로 복구 가능해야 함 |
| 테스트 | 스테이징 환경에서 충분한 테스트 후 프로덕션 적용 |
| 시점 | Phase 4 진입이 확정되면 상세 계획 수립 |
