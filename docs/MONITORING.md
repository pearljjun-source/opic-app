# 분석, 모니터링 & 법적 요구사항

> API 비용, 분석 이벤트, 에러 모니터링, 법적 문서

## API 비용 분석 (학생 50명 기준)

### 가정
- 학생 1명당 하루 5회 연습
- 녹음 1회당 평균 2분
- 월 25일 활동

### 서비스별 비용

| 서비스 | 단가 | 월 비용 |
|--------|------|---------|
| Supabase Pro | $25/월 (고정) | $25 |
| Whisper API | $0.006/분 | $150 |
| OpenAI TTS | 캐싱으로 거의 무료 | ~$0 |
| Claude Haiku | $0.25/100만 토큰 | $10 |
| **합계** | | **~$185/월** |

**학생 1명당 비용: ~$3.7/월**

---

### STT (Whisper API)

| 항목 | 값 |
|------|-----|
| 가격 | $0.006/분 |
| 월 사용량 | 50명 × 5회 × 2분 × 25일 = 12,500분 |
| 월 비용 | 12,500 × $0.006 = **$75** |
| 실제 예상 | 매일 연습 안 하므로 ~**$150** |

### TTS (OpenAI TTS + 캐싱)

| 항목 | 값 |
|------|-----|
| 가격 | $15/100만 글자 |
| 캐싱 전략 | 질문 오디오 미리 생성 → Storage 저장 |
| 월 비용 | **~$0** (캐싱 덕분) |

### AI 피드백 (Claude Haiku)

| 항목 | 값 |
|------|-----|
| 입력 | $0.25/100만 토큰 |
| 출력 | $1.25/100만 토큰 |
| 예상 사용량 | 연습 1회당 ~2,000 토큰 |
| 월 비용 | **~$10** |

---

## 분석 이벤트

### 사용자 이벤트
- user_signup (role, method)
- user_login (method)
- user_logout

### 스크립트 이벤트
- script_created (topic, question_type)
- script_viewed (script_id)
- script_updated (script_id)

### 연습 이벤트
- practice_started (script_id)
- practice_completed (script_id, duration, score)
- practice_abandoned (script_id, at_step)

### 에러 이벤트
- error_occurred (type, message, screen)
- recording_failed (error)
- stt_failed (error)

---

## 에러 모니터링 (Sentry)

```typescript
// lib/sentry.ts

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

export function initSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_APP_ENV,
    release: Constants.expoConfig?.version,

    // 프로덕션에서만 활성화
    enabled: process.env.EXPO_PUBLIC_APP_ENV === 'production',

    // 성능 모니터링
    tracesSampleRate: 0.2,

    // 민감 정보 필터링
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
}

// 사용 예시
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}
```

---

## 법적 필수 문서

### 이용약관 (Terms of Service)
- 서비스 설명
- 이용 조건
- 금지 행위
- 면책 조항
- 계정 해지
- 분쟁 해결

### 개인정보처리방침 (Privacy Policy)
- 수집하는 개인정보 항목
  - 이메일, 이름
  - 음성 녹음 데이터
  - 학습 기록
- 수집 목적
- 보관 기간
- 제3자 제공 (OpenAI, Anthropic API 사용)
- 이용자 권리 (열람, 정정, 삭제)
- 연락처

**위치**: 앱 내 설정 화면 + 앱스토어 페이지

---

## 동의 수집

```typescript
// 회원가입 시 동의 체크

interface ConsentState {
  termsAgreed: boolean;        // 이용약관 동의 (필수)
  privacyAgreed: boolean;      // 개인정보처리방침 동의 (필수)
  voiceDataAgreed: boolean;    // 음성 데이터 수집 동의 (필수)
  marketingAgreed: boolean;    // 마케팅 수신 동의 (선택)
}

// 동의 내역 저장
await supabase
  .from('user_consents')
  .insert({
    user_id: user.id,
    terms_agreed: true,
    terms_agreed_at: new Date().toISOString(),
    privacy_agreed: true,
    privacy_agreed_at: new Date().toISOString(),
    voice_data_agreed: true,
    voice_data_agreed_at: new Date().toISOString(),
    marketing_agreed: false,
  });
```

---

## 참고 자료

### 공식 문서
- [Expo 문서](https://docs.expo.dev/)
- [Expo Router 문서](https://docs.expo.dev/router/introduction/)
- [Supabase 문서](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [OpenAI API 문서](https://platform.openai.com/docs)
- [Anthropic Claude 문서](https://docs.anthropic.com/)

### 라이브러리
- [expo-av (녹음/재생)](https://docs.expo.dev/versions/latest/sdk/av/)
- [expo-notifications (푸시)](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [expo-secure-store (보안 저장)](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Zustand (상태 관리)](https://github.com/pmndrs/zustand)
- [NativeWind (Tailwind)](https://www.nativewind.dev/)

### 배포
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)
- [Google Play Console](https://play.google.com/console/)

### 모니터링
- [Sentry React Native](https://docs.sentry.io/platforms/react-native/)
- [Supabase Dashboard](https://supabase.com/dashboard)
