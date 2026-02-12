# 테스트 & 성능 최적화

> 테스트 전략, 테스트 도구, 성능 최적화 가이드

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
