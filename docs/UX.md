# 에러 처리 & UX 전략

> 에러 유형별 처리, 로딩 상태, 빈 상태, 토스트 메시지

## 에러 유형별 처리 전략

### 네트워크 에러
- 타임아웃 (10초)
- 연결 실패
- 서버 응답 없음

**처리:**
- 토스트 메시지: "네트워크 연결을 확인해주세요"
- 재시도 버튼 제공
- 자동 재시도 (3회, 지수 백오프)

### 인증 에러
- 토큰 만료 (401)
- 권한 없음 (403)
- 잘못된 자격증명

**처리:**
- 401: 자동으로 토큰 갱신 시도
- 갱신 실패: 로그인 화면으로 이동
- 403: "접근 권한이 없습니다" + 이전 화면

### API 에러
- 400 Bad Request
- 404 Not Found
- 500 Server Error
- Rate Limit (429)

**처리:**
- 400: 입력값 검증 메시지 표시
- 404: "데이터를 찾을 수 없습니다"
- 500: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요"
- 429: "요청 한도 초과. N분 후 다시 시도해주세요"

### 녹음/오디오 에러
- 마이크 권한 거부
- 녹음 실패
- 파일 손상
- STT 변환 실패

**처리:**
- 권한 거부: 설정 화면으로 안내
- 녹음 실패: "녹음 중 오류. 다시 시도해주세요"
- STT 실패: "음성 인식 실패. 다시 녹음해주세요"

---

## 에러 처리 코드 패턴

```typescript
// lib/api.ts - API 래퍼

interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export async function apiCall<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number;
    retryDelay?: number;
  }
): Promise<ApiResponse<T>> {
  const { retries = 3, retryDelay = 1000 } = options || {};

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = await fn();
      return { data, error: null };
    } catch (err: any) {
      // 재시도하면 안 되는 에러
      if (err.status === 401 || err.status === 403 || err.status === 400) {
        return {
          data: null,
          error: {
            code: `HTTP_${err.status}`,
            message: getErrorMessage(err.status),
            details: err.message,
          },
        };
      }

      // 마지막 시도 실패
      if (attempt === retries) {
        return {
          data: null,
          error: {
            code: 'NETWORK_ERROR',
            message: '네트워크 연결을 확인해주세요.',
            details: err.message,
          },
        };
      }

      // 지수 백오프로 재시도 대기
      await sleep(retryDelay * Math.pow(2, attempt));
    }
  }

  return { data: null, error: { code: 'UNKNOWN', message: '알 수 없는 오류' } };
}

function getErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    400: '입력값을 확인해주세요.',
    401: '로그인이 필요합니다.',
    403: '접근 권한이 없습니다.',
    404: '요청한 데이터를 찾을 수 없습니다.',
    429: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
    500: '서버 오류가 발생했습니다.',
  };
  return messages[status] || '오류가 발생했습니다.';
}
```

---

## 로딩 상태 UX

### 로딩 시간별 처리
| 시간 | 처리 |
|------|------|
| 0~300ms | 아무것도 표시 안 함 (깜빡임 방지) |
| 300ms~2s | 스피너 표시 |
| 2s~10s | 스켈레톤 UI + "로딩 중..." 텍스트 |
| 10s+ | "시간이 오래 걸리고 있어요" 메시지 |

### 화면별 로딩 UI
| 화면 | 로딩 UI |
|------|---------|
| 목록 화면 (학생, 스크립트) | 스켈레톤 카드 3~5개 |
| 상세 화면 (스크립트) | 스켈레톤: 제목 + 본문 영역 |
| 연습 화면 | 중앙 스피너 + "질문을 불러오는 중..." |
| STT 변환 중 | 진행 바 + "음성을 분석하고 있어요..." (5~15초) |
| AI 피드백 생성 중 | 진행 바 + "피드백을 생성하고 있어요..." (3~10초) |

---

## 빈 상태 (Empty State) 디자인

### 강사 - 학생 목록 비어있음
- 아이콘: 👥
- 제목: "아직 연결된 학생이 없어요"
- 설명: "초대 코드를 생성해서 학생들을 초대해보세요"
- 버튼: [학생 초대하기]

### 학생 - 스크립트 목록 비어있음
- 아이콘: 📝
- 제목: "아직 스크립트가 없어요"
- 설명: "강사님이 스크립트를 작성하면 여기에 표시됩니다"
- 버튼: 없음 (대기 상태)

### 학생 - 연습 기록 비어있음
- 아이콘: 🎤
- 제목: "아직 연습 기록이 없어요"
- 설명: "스크립트를 선택해서 첫 연습을 시작해보세요!"
- 버튼: [스크립트 보러가기]

### 검색 결과 없음
- 아이콘: 🔍
- 제목: "검색 결과가 없어요"
- 설명: "다른 검색어로 시도해보세요"

---

## 토스트 & 알림 메시지

```typescript
// lib/toast.ts

export const TOAST_MESSAGES = {
  // 성공
  SUCCESS: {
    SCRIPT_SAVED: '스크립트가 저장되었습니다.',
    PRACTICE_COMPLETE: '연습이 완료되었습니다!',
    INVITE_SENT: '초대 코드가 생성되었습니다.',
    PROFILE_UPDATED: '프로필이 업데이트되었습니다.',
    CONNECTED: '강사님과 연결되었습니다!',
  },

  // 에러
  ERROR: {
    NETWORK: '네트워크 연결을 확인해주세요.',
    GENERIC: '오류가 발생했습니다. 다시 시도해주세요.',
    PERMISSION_DENIED: '권한이 거부되었습니다.',
    INVALID_CODE: '유효하지 않은 초대 코드입니다.',
    RECORDING_FAILED: '녹음 중 오류가 발생했습니다.',
    STT_FAILED: '음성 인식에 실패했습니다. 다시 시도해주세요.',
  },

  // 경고
  WARNING: {
    UNSAVED_CHANGES: '저장하지 않은 변경사항이 있습니다.',
    LOW_STORAGE: '저장 공간이 부족합니다.',
    RECORDING_TOO_SHORT: '녹음이 너무 짧습니다. (최소 5초)',
  },

  // 정보
  INFO: {
    RECORDING_TIP: '조용한 환경에서 녹음하면 더 정확해요!',
    FIRST_PRACTICE: '첫 연습이에요! 화이팅!',
  },
} as const;
```
