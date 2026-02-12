# 기능 상세 스펙

> 핵심 기능, 녹음, 푸시 알림, 오프라인 지원, 앱 상태 관리

## 스크립트 vs 실제 답변 비교 플로우

```
1️⃣ 강사가 스크립트 작성 → DB 저장
        ↓
2️⃣ 학생이 질문 듣고 녹음 (스크립트 안 보고!)
        ↓
3️⃣ Whisper API (STT) → 음성 → 텍스트
        ↓
4️⃣ Claude API (비교 분석) → AI 피드백 생성
        ↓
5️⃣ 학생에게 결과 표시
```

## AI 피드백 구조

```typescript
interface AIFeedback {
  summary: string;           // 전체 요약
  reproduction_rate: number; // 재현율 (0-100%)
  missed_phrases: string[];  // 빠뜨린 표현
  extra_phrases: string[];   // 추가된 표현
  pronunciation_tips: string[];
  grammar_issues: string[];
  suggestions: string[];
}
```

## TTS 캐싱 전략

- questions 테이블에 audio_url 컬럼
- 질문 등록 시 TTS로 오디오 생성 → Storage 저장
- 학생 연습 시 audio_url로 바로 재생
- 결과: TTS 비용 거의 $0

---

## 녹음 기능 상세 스펙

### 오디오 설정
- 포맷: M4A (AAC 코덱)
- 샘플레이트: 44,100 Hz
- 비트레이트: 128 kbps
- 채널: Mono (1채널)

### 시간 제한
- 최소: 5초
- 최대: 180초 (3분)
- 권장: 30~120초

### 녹음 플로우

```
1️⃣ 권한 확인 → 권한 없음 → 설정 안내
        ↓
2️⃣ 질문 오디오 재생 (TTS 캐싱)
        ↓
3️⃣ 녹음 대기 (3초 카운트다운)
        ↓
4️⃣ 녹음 중 (정지 버튼, 타이머, 파형)
        ↓
5️⃣ 녹음 완료 [다시 듣기] [다시 녹음] [제출]
        ↓
6️⃣ 업로드 & 분석 (5~15초)
        ↓
7️⃣ 결과 화면
```

### 녹음 코드 설정

```typescript
export const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
};

export const RECORDING_LIMITS = {
  MIN_DURATION_SEC: 5,
  MAX_DURATION_SEC: 180,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
};
```

---

## 푸시 알림 설계

### 강사용 알림
| 유형 | 제목 | 내용 |
|------|------|------|
| 학생 연결 | 새 학생 연결! | {학생명}님이 연결... |
| 연습 완료 | 연습 완료 | {학생명}님이 연습... |
| 피드백 요청 | 피드백 요청 | 3명의 학생이... |

### 학생용 알림
| 유형 | 제목 | 내용 |
|------|------|------|
| 새 스크립트 | 새 스크립트! | 강사님이 새 스크립... |
| 강사 피드백 | 피드백 도착! | 강사님이 피드백을... |
| 연습 리마인더 | 오늘 연습했나요? | 꾸준한 연습이... |

### 알림 설정

```typescript
interface NotificationSettings {
  enabled: boolean;
  newScript: boolean;
  scriptUpdated: boolean;
  teacherFeedback: boolean;
  practiceReminder: boolean;
  reminderTime: string;      // "20:00"
  reminderDays: number[];    // [1,2,3,4,5] = 월~금
}
```

---

## 오프라인 지원

### 오프라인에서 가능
- 이미 로드된 스크립트/연습 기록 보기
- 질문 오디오 재생 (캐싱된 경우)
- 녹음하기 (로컬 저장)

### 오프라인에서 불가
- 로그인/회원가입
- 새 데이터 불러오기
- STT/AI 피드백 (API 필요)
- 녹음 업로드

### 오프라인 녹음 처리
1. 녹음 파일을 로컬에 저장
2. "네트워크 연결 시 자동 업로드됩니다" 메시지
3. 온라인 복귀 시 자동 업로드 + 분석

---

## 앱 상태 관리

### 앱 상태 종류
- `active`: 포그라운드에서 실행 중
- `background`: 백그라운드로 이동
- `inactive`: (iOS) 전환 중 상태

### 녹음 중 상태 변화 처리

| 상황 | 처리 |
|------|------|
| 백그라운드 이동 | 녹음 계속 유지 |
| 전화 수신 | 녹음 일시 정지, 종료 후 재개 여부 물어봄 |
| 앱 강제 종료 | 녹음 파일 자동 저장, 재시작 시 복구 여부 물어봄 |

### 앱 상태 훅

```typescript
export function useAppState(
  onForeground?: () => void,
  onBackground?: () => void
) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        onForeground?.();
      }
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        onBackground?.();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [onForeground, onBackground]);
}
```
