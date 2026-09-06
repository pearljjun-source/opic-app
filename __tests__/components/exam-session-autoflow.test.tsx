/**
 * 시험 세션 화면 — 자동 모드(CBT) 상태 전이 테스트
 *
 * 이 화면에서 이번 세션에 두 가지가 터졌다.
 *
 *   1. "답변 준비 0" 데드락 — 음성 동의가 없으면 카운트다운 0에서 멈췄다
 *   2. TTS 무한 재시도 — 재생이 실패하면 상태가 ready 로 돌아가고, 자동 재생
 *      effect 가 다시 돌아 0.5초마다 재시도했다. 알림이 쌓이고 TTS 쿼터가
 *      25초면 소진된다
 *
 * 둘 다 상태 전이 문제였고, 화면을 한 번도 그려보지 않았기 때문에 865개 테스트가
 * 전부 통과하는 동안 프로덕션에 있었다.
 *
 * ⚠️ 이 파일은 자동 모드 전이만 본다. 녹음 업로드·STT·결과 처리는 서비스 테스트가
 *    덮는다. 화면 전체를 덮으려 하면 모킹이 구현에 묶여 리팩터링마다 깨진다.
 */

import { render, screen, act } from '@testing-library/react-native';

// ── 라우팅 ───────────────────────────────────────────────────────────────────
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useSegments: () => ['(student)'],
  router: { replace: mockReplace, back: mockBack, push: jest.fn() },
}));

// ── expo-audio ───────────────────────────────────────────────────────────────
// 재생 완료를 테스트가 직접 조종한다 (didJustFinish)
const mockPlayer = { replace: jest.fn(), play: jest.fn(), pause: jest.fn(), remove: jest.fn() };
let mockPlayerStatus = { didJustFinish: false, playing: false };

const mockRecorder = {
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(),
  stop: jest.fn(async () => {}),
  uri: 'file:///tmp/rec.m4a',
};

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockPlayerStatus,
  useAudioRecorder: () => mockRecorder,
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: jest.fn(async () => {}),
}));

// ── 훅 ───────────────────────────────────────────────────────────────────────
const mockConsent = {
  consentStatus: 'agreed' as 'loading' | 'agreed' | 'not_agreed',
  showConsentModal: false,
  requireConsent: jest.fn(() => true),
  handleAgree: jest.fn(async () => true),
  handleDecline: jest.fn(),
};

jest.mock('@/hooks/useVoiceConsent', () => ({ useVoiceConsent: () => mockConsent }));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ currentOrg: { id: 'org-1', name: '테스트학원' }, user: { id: 'student-1' } }),
}));

// ── 서비스 ───────────────────────────────────────────────────────────────────
const mockGenerateQuestionAudio = jest.fn(async () => ({
  data: { audioUrl: 'https://cdn.test/q1.mp3', cached: true },
  error: null as any,
}));

jest.mock('@/services/practices', () => ({
  generateQuestionAudio: (...a: any[]) => mockGenerateQuestionAudio(...(a as [])),
  uploadRecording: jest.fn(async () => ({ data: { path: 'student-1/p.webm' }, error: null })),
  transcribeAudio: jest.fn(async () => ({ data: { transcription: '' }, error: null })),
}));

jest.mock('@/services/exams', () => ({
  abandonExamSession: jest.fn(async () => ({ error: null })),
  generateLevelTestQuestions: jest.fn(async () => ({ data: { questions: [] }, error: null })),
  checkExamAvailability: jest.fn(async () => ({ success: true })),
  createExamSession: jest.fn(async () => ({ data: { sessionId: 's1' }, error: null })),
  submitExamResponse: jest.fn(async () => ({ error: null })),
}));

const mockAlert = jest.fn();
jest.mock('@/lib/alert', () => ({
  alert: (...a: any[]) => mockAlert(...a),
  confirm: jest.fn(),
}));

import SessionScreen from '@/app/(student)/exam/session';

// ── 픽스처 ───────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    question_id: 'q1',
    question_text: 'Tell me about your home.',
    question_type: 'describe',
    question_order: 1,
    source: 'question',
    audio_url: null,
    is_scored: true,
  },
  {
    question_id: 'q2',
    question_text: 'Describe your neighborhood.',
    question_type: 'describe',
    question_order: 2,
    source: 'question',
    audio_url: null,
    is_scored: true,
  },
];

function setParams(extra: Record<string, string> = {}) {
  mockParams = {
    sessionId: 'session-1',
    examType: 'mock_exam',
    questions: JSON.stringify(QUESTIONS),
    autoPlay: 'true',
    ...extra,
  };
}

/** 자동 재생 effect 의 0.5초 딜레이 + TTS 요청 resolve 를 함께 흘린다 */
async function flushAutoPlay() {
  act(() => { jest.advanceTimersByTime(600); });
  await act(async () => {});
}

/** 준비 카운트다운은 매 초 새 타이머를 건다. 1초씩 나눠야 effect 가 따라온다 */
function runPrepCountdown(seconds = 3) {
  for (let i = 0; i < seconds; i++) {
    act(() => { jest.advanceTimersByTime(1000); });
  }
}

/** TTS 재생이 끝났다고 알린다 */
function finishPlayback(view: ReturnType<typeof render>) {
  mockPlayerStatus = { didJustFinish: true, playing: false };
  act(() => { view.rerender(<SessionScreen />); });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  setParams();
  mockPlayerStatus = { didJustFinish: false, playing: false };
  mockConsent.consentStatus = 'agreed';
  mockConsent.requireConsent = jest.fn(() => true);
  mockGenerateQuestionAudio.mockResolvedValue({
    data: { audioUrl: 'https://cdn.test/q1.mp3', cached: true },
    error: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// 기본 렌더링 — 화면이 그려지기만 해도 잡히는 것들이 있다
// ============================================================================

describe('시험 세션 진입', () => {
  it('전달받은 문항을 보여준다', () => {
    render(<SessionScreen />);

    expect(screen.getByText('Tell me about your home.')).toBeTruthy();
  });

  it('진행 상황을 보여준다', () => {
    render(<SessionScreen />);

    expect(screen.getByText('Q1/2')).toBeTruthy();
  });

  it('자동 모드에서는 "질문 듣기" 버튼을 숨긴다 (자동 재생되므로)', () => {
    render(<SessionScreen />);

    expect(screen.queryByText('질문 듣기')).toBeNull();
  });

  it('수동 모드에서는 "질문 듣기" 버튼이 있다', () => {
    setParams({ autoPlay: 'false' });
    render(<SessionScreen />);

    expect(screen.getByText('질문 듣기')).toBeTruthy();
  });

  it('문항 데이터가 깨져 있으면 알리고 되돌린다', () => {
    setParams({ questions: 'not-json' });

    render(<SessionScreen />);

    expect(mockAlert).toHaveBeenCalled();
  });
});

// ============================================================================
// 자동 재생 → 준비 카운트다운
// ============================================================================

describe('자동 모드 전이', () => {
  it('진입하면 질문 음성을 자동으로 재생한다', async () => {
    render(<SessionScreen />);

    await flushAutoPlay();

    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('재생이 끝나면 준비 카운트다운이 뜬다', async () => {
    const view = render(<SessionScreen />);
    await flushAutoPlay();

    finishPlayback(view);

    expect(screen.getByText('답변 준비')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('준비 카운트다운이 3초에서 줄어든다', async () => {
    const view = render(<SessionScreen />);
    await flushAutoPlay();
    finishPlayback(view);

    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('2')).toBeTruthy();

    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('1')).toBeTruthy();
  });
});

// ============================================================================
// TTS 실패 — 무한 재시도가 없어야 한다
// ============================================================================

describe('TTS 재생 실패', () => {
  beforeEach(() => {
    mockGenerateQuestionAudio.mockResolvedValue({
      data: null as any,
      error: new Error('rate limit'),
    });
  });

  it('실패해도 시험이 멈추지 않고 답변 단계로 넘어간다', async () => {
    render(<SessionScreen />);

    await flushAutoPlay();

    expect(screen.getByText('답변 준비')).toBeTruthy();
  });

  it('같은 문항에서 재시도하지 않는다 — 0.5초마다 부르던 무한 루프', async () => {
    render(<SessionScreen />);

    await flushAutoPlay();
    const callsAfterFirst = mockGenerateQuestionAudio.mock.calls.length;

    // 루프가 있었다면 이 사이에 수십 번 더 불렸다
    for (let i = 0; i < 10; i++) {
      act(() => { jest.advanceTimersByTime(600); });
    }

    expect(mockGenerateQuestionAudio.mock.calls.length).toBe(callsAfterFirst);
  });

  it('자동 모드에서는 실패 알림을 띄우지 않는다 — 시험 흐름이 끊긴다', async () => {
    render(<SessionScreen />);

    await flushAutoPlay();

    const ttsAlerts = mockAlert.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('음성'),
    );
    expect(ttsAlerts).toHaveLength(0);
  });
});

// ============================================================================
// 음성 동의 — 데드락이 났던 지점
// ============================================================================

describe('음성 녹음 동의', () => {
  it('동의 조회 중에는 녹음 시작 자체를 시도하지 않는다', async () => {
    // ⚠️ recorder.record 로 보면 안 된다. 녹음 시작은 비동기라, 가드가 없어도
    //    이 시점엔 아직 안 불린다. requireConsent 가 불렸는지로 봐야
    //    "시작을 시도했는가" 를 구분할 수 있다.
    mockConsent.consentStatus = 'loading';
    const view = render(<SessionScreen />);

    await flushAutoPlay();
    finishPlayback(view);
    runPrepCountdown();

    expect(mockConsent.requireConsent).not.toHaveBeenCalled();
  });

  it('동의 조회가 끝나면 멈춰 있던 녹음이 이어진다 — 데드락 방지', async () => {
    mockConsent.consentStatus = 'loading';
    const view = render(<SessionScreen />);

    await flushAutoPlay();
    finishPlayback(view);
    runPrepCountdown();
    expect(mockConsent.requireConsent).not.toHaveBeenCalled();

    // 조회 완료 → effect 가 다시 돌아 멈춰 있던 녹음을 시작한다
    mockConsent.consentStatus = 'agreed';
    act(() => { view.rerender(<SessionScreen />); });

    expect(mockConsent.requireConsent).toHaveBeenCalled();
  });

  it('동의가 이미 끝난 학생은 카운트다운이 0이 되면 바로 녹음을 시작한다', async () => {
    const view = render(<SessionScreen />);

    await flushAutoPlay();
    finishPlayback(view);
    runPrepCountdown();

    expect(mockConsent.requireConsent).toHaveBeenCalled();
  });
});
