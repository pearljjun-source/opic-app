# 테스트 & 성능 최적화

> 테스트 전략, 테스트 도구, 성능 최적화 가이드

> ⚠️ **아래 "테스트 피라미드"와 "테스트 도구"는 처음 작성 당시의 목표다.**
> 2026-09-07 기준 실제 상태는 아래와 같다.
>
> | 항목 | 상태 |
> |------|------|
> | 서비스 실행 테스트 | 763개. 소스 문자열 대조 테스트는 전부 실행 테스트로 교체됨 |
> | `services` 커버리지 | 51.2% (`topics` 93.2 · `students` 90.9 · `classes` 88.9 · `messages` 88.9 · `billing` 62.3 · `practices` 47.8) |
> | 컴포넌트 테스트 | `exam/orientation` · `exam/session`(자동 모드) + `useExamAutoFlow` 훅 |
> | E2E | Maestro 플로우 1개 (아래) — 수동 실행 |
> | 스키마 드리프트 | `npm run check:schema`, CI 매일 |
>
> 남은 커버리지 0% 서비스: `organizations` `admin` `notifications` `landing` `expressions`
>
> 진행 상황은 [CLAUDE.md의 "테스트 로드맵"](../CLAUDE.md) 참조.

## E2E (Maestro)

> 핵심 유저 플로우 하나만 본다: **로그인 → 토픽 → 스크립트 → 녹음 → 결과 → 정리**
> 화면 세부 동작은 컴포넌트 테스트가, 서버 호출은 서비스 테스트가 덮는다.

플로우: [.maestro/student-practice-flow.yaml](../.maestro/student-practice-flow.yaml)

### 준비

**1. Maestro 설치**

```bash
# macOS / Linux
curl -Ls "https://get.maestro.mobile.dev" | bash

# Windows — WSL 또는 Git Bash 에서 위 명령, 아니면 아래 문서 참조
# https://docs.maestro.dev/getting-started/installing-maestro
```

**2. 전용 계정**

⚠️ **실제 학원에 넣지 말 것.** development/preview/production 이 같은 Supabase
프로젝트를 쓰므로, 테스트 데이터가 실사용자와 같은 DB 에 쌓인다.

| 계정 | 준비할 것 |
|------|----------|
| `zz-e2e-teacher@...` | 전용 학원 생성 → 학생 초대 → 토픽 배정 → **스크립트 1개 이상 작성** |
| `zz-e2e-student@...` | 위 강사와 연결된 상태 |

스크립트는 강사가 써주는 것이라, 학생 계정만으로는 이 플로우를 끝까지 갈 수 없다.

**3. 앱 빌드**

```bash
eas build --profile development --platform android
# 또는 로컬 빌드 후 에뮬레이터에 설치
```

### 실행

```bash
maestro test -e EMAIL=zz-e2e-student@... -e PASSWORD=... .maestro/student-practice-flow.yaml
```

⚠️ **계정 정보를 파일이나 저장소에 넣지 않는다.** 환경변수로만 넘긴다.

### 알아둘 것

- **실제 비용이 든다.** Whisper STT 와 Claude 피드백을 진짜로 호출한다. 1회 실행에
  몇십 원, 그리고 시간당 호출 한도(whisper 30 / claude 30)를 소비한다.
  전용 계정이므로 실사용자 한도에는 영향이 없다.
- **소리를 낼 수 없으므로 무음 5초를 녹음한다.** Whisper 가 빈 전사를 돌려줘도
  플로우 자체는 끝까지 간다. E2E 가 보려는 것은 "화면이 이어지는가" 이지
  "AI 가 정확한가" 가 아니다.
- **마지막에 만든 연습 기록을 지운다.** 프로덕션 DB 에 테스트 데이터를 남기지 않기
  위해서이고, 동시에 삭제 플로우(녹음 파일까지 삭제)도 검증된다.
- **CI 에 넣지 않았다.** 앱 빌드와 에뮬레이터가 필요해 러너 설정이 무겁고,
  외부 API 비용이 매 PR 마다 발생한다. 배포 전 수동 실행이 맞다.

### 요소를 문구로 찾지 않는다

[lib/testIds.ts](../lib/testIds.ts) 에 정의한 `testID` 로만 찾는다.
"실전 연습" 을 "연습하기" 로 바꾸는 순간 E2E 가 깨지면, 그 테스트는 금방 방치된다.
`testID` 는 화면에 보이지 않는 계약이라 문구와 무관하게 유지된다.

⚠️ `TEST_IDS` 값을 바꾸면 `.maestro/` 플로우도 함께 고쳐야 한다.

---

## 테스트 피라미드

```
           /\
          /  \        E2E 테스트 (10%)
         /    \       - 핵심 유저 플로우
        /──────\
       /        \     통합 테스트 (20%)
      /          \    - API 호출
     /────────────\   - DB 연동
    /              \
   /                \ 단위 테스트 (70%)
  /                  \ - 유틸 함수
 /────────────────────\ - 컴포넌트
```

## Phase 1 테스트 범위 (MVP)

- 핵심 비즈니스 로직 단위 테스트
- 인증 플로우 E2E 테스트
- 연습 플로우 E2E 테스트

---

## 테스트 도구

```json
// package.json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "jest-expo": "^50.0.0",
    "@testing-library/react-native": "^12.0.0",
    "@testing-library/jest-native": "^5.0.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## 테스트 예시

```typescript
// __tests__/lib/validation.test.ts

import {
  validateEmail,
  validatePassword,
  validateScriptContent
} from '@/lib/validation';

describe('validateEmail', () => {
  it('유효한 이메일을 허용해야 함', () => {
    expect(validateEmail('test@example.com').valid).toBe(true);
    expect(validateEmail('user.name@domain.co.kr').valid).toBe(true);
  });

  it('유효하지 않은 이메일을 거부해야 함', () => {
    expect(validateEmail('invalid').valid).toBe(false);
    expect(validateEmail('no@domain').valid).toBe(false);
    expect(validateEmail('@domain.com').valid).toBe(false);
  });
});

describe('validatePassword', () => {
  it('8자 이상 영문+숫자 조합을 허용해야 함', () => {
    expect(validatePassword('password123').valid).toBe(true);
    expect(validatePassword('MyPass99').valid).toBe(true);
  });

  it('8자 미만을 거부해야 함', () => {
    expect(validatePassword('pass1').valid).toBe(false);
  });

  it('숫자 없는 비밀번호를 거부해야 함', () => {
    expect(validatePassword('passwordonly').valid).toBe(false);
  });
});

describe('validateScriptContent', () => {
  it('빈 스크립트를 거부해야 함', () => {
    expect(validateScriptContent('').valid).toBe(false);
    expect(validateScriptContent('   ').valid).toBe(false);
  });

  it('5000자 초과를 거부해야 함', () => {
    const longText = 'a'.repeat(5001);
    expect(validateScriptContent(longText).valid).toBe(false);
  });

  it('유효한 스크립트를 허용해야 함', () => {
    expect(validateScriptContent('My home is very cozy.').valid).toBe(true);
  });
});
```

---

## 성능 최적화 가이드

### 리스트 최적화
- FlatList 사용 (ScrollView + map 금지)
- keyExtractor 항상 제공
- getItemLayout 제공 (고정 높이인 경우)
- windowSize 조정 (기본값 21)
- removeClippedSubviews={true}

### 이미지 최적화
- expo-image 사용 (Image 대신)
- 적절한 크기로 리사이즈
- 캐싱 활성화
- placeholder 제공

### 리렌더링 최적화
- React.memo 적절히 사용
- useCallback, useMemo 활용
- 불필요한 state 업데이트 방지

### 번들 사이즈 최적화
- 필요한 패키지만 설치
- 트리 쉐이킹 지원 패키지 사용
- 동적 import 활용

---

## 성능 최적화 코드 예시

```typescript
// FlatList 최적화
import { FlatList } from 'react-native';
import { memo, useCallback } from 'react';

const ScriptCard = memo(({ item, onPress }) => (
  // 카드 컴포넌트
));

function ScriptList({ scripts }) {
  const renderItem = useCallback(
    ({ item }) => <ScriptCard item={item} onPress={() => {}} />,
    []
  );

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <FlatList
      data={scripts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
    />
  );
}

// 이미지 최적화
import { Image } from 'expo-image';

function Avatar({ uri }) {
  return (
    <Image
      source={{ uri }}
      style={{ width: 50, height: 50, borderRadius: 25 }}
      placeholder={{ blurhash: 'LKO2:N%2Tw=w]~RBVZRi};RPxuwH' }}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={200}
    />
  );
}
```
