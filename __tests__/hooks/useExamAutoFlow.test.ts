/**
 * 시험 자동 모드 상태 전이 훅 테스트
 *
 * session.tsx 화면 테스트(exam-session-autoflow.test.tsx)가 통합 관점에서
 * 같은 흐름을 보지만, 그쪽은 expo-audio·서비스·라우터를 전부 모킹해야 해서
 * 경계 조건을 하나씩 넣어보기가 무겁다.
 *
 * 전이 자체는 오디오나 렌더링과 무관하므로 여기서 직접 돌린다.
 * 화면이 리팩터링돼도 이 테스트는 그대로 남는다.
 */

import { renderHook, act } from '@testing-library/react-native';

import { useExamAutoFlow, type ExamSessionState } from '@/hooks/useExamAutoFlow';

const QUESTION = { source: 'question', question_id: 'q1' };
const ROLEPLAY = { source: 'roleplay', question_id: null };

type Params = Parameters<typeof useExamAutoFlow>[0];

function setup(overrides: Partial<Params> = {}) {
  const setSessionState = jest.fn();
  const onPlayQuestion = jest.fn();
  const onStartRecording = jest.fn();
  const onNextQuestion = jest.fn();

  const base: Params = {
    isAutoPlayMode: true,
    sessionState: 'ready',
    setSessionState,
    currentIndex: 0,
    currentQuestion: QUESTION,
    consentStatus: 'agreed',
    didJustFinish: false,
    onPlayQuestion,
    onStartRecording,
    onNextQuestion,
    ...overrides,
  };

  const view = renderHook((props: Params) => useExamAutoFlow(props), {
    initialProps: base,
  });

  return { view, setSessionState, onPlayQuestion, onStartRecording, onNextQuestion, base };
}

/** 준비 카운트다운은 매 초 새 타이머를 건다. 1초씩 나눠야 effect 가 따라온다 */
function tickSeconds(n: number) {
  for (let i = 0; i < n; i++) {
    act(() => { jest.advanceTimersByTime(1000); });
  }
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// 자동 재생
// ============================================================================

describe('ready 진입 → 자동 재생', () => {
  it('0.5초 뒤에 질문을 재생한다', () => {
    const { onPlayQuestion } = setup();

    expect(onPlayQuestion).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(500); });

    expect(onPlayQuestion).toHaveBeenCalledTimes(1);
  });

  it('수동 모드에서는 자동 재생하지 않는다', () => {
    const { onPlayQuestion } = setup({ isAutoPlayMode: false });

    act(() => { jest.advanceTimersByTime(1000); });

    expect(onPlayQuestion).not.toHaveBeenCalled();
  });

  it('ready 가 아니면 재생하지 않는다', () => {
    const { onPlayQuestion } = setup({ sessionState: 'recording' });

    act(() => { jest.advanceTimersByTime(1000); });

    expect(onPlayQuestion).not.toHaveBeenCalled();
  });

  it('문항이 아직 없으면 재생하지 않는다', () => {
    const { onPlayQuestion } = setup({ currentQuestion: null });

    act(() => { jest.advanceTimersByTime(1000); });

    expect(onPlayQuestion).not.toHaveBeenCalled();
  });

  it('롤플레이 문항은 TTS 대상이 아니라 바로 준비 단계로 간다', () => {
    const { setSessionState, onPlayQuestion } = setup({ currentQuestion: ROLEPLAY });

    expect(setSessionState).toHaveBeenCalledWith('prep_countdown');
    expect(onPlayQuestion).not.toHaveBeenCalled();
  });

  it('문항이 바뀌면 다시 재생한다', () => {
    const { view, base, onPlayQuestion } = setup();

    act(() => { jest.advanceTimersByTime(500); });
    expect(onPlayQuestion).toHaveBeenCalledTimes(1);

    act(() => {
      view.rerender({ ...base, currentIndex: 1, currentQuestion: { source: 'question', question_id: 'q2' } });
    });
    act(() => { jest.advanceTimersByTime(500); });

    expect(onPlayQuestion).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// TTS 실패 — 무한 재시도 방지
// ============================================================================

describe('TTS 실패 기록', () => {
  it('실패를 기록한 문항은 재생을 시도하지 않고 준비 단계로 넘어간다', () => {
    const { view, base, setSessionState, onPlayQuestion } = setup();

    // 재생 시도 → 실패 기록
    act(() => { jest.advanceTimersByTime(500); });
    expect(onPlayQuestion).toHaveBeenCalledTimes(1);
    act(() => { view.result.current.markTtsFailed(0); });

    // 화면이 상태를 ready 로 되돌린다 (실패 경로) → effect 재실행
    act(() => { view.rerender({ ...base, sessionState: 'playing_question' as ExamSessionState }); });
    setSessionState.mockClear();
    act(() => { view.rerender({ ...base, sessionState: 'ready' as ExamSessionState }); });

    // 재시도하지 않고 준비 단계로 보낸다
    act(() => { jest.advanceTimersByTime(2000); });
    expect(onPlayQuestion).toHaveBeenCalledTimes(1);
    expect(setSessionState).toHaveBeenCalledWith('prep_countdown');
  });

  it('실패는 문항별로 기록된다 — 다음 문항은 다시 시도한다', () => {
    const { view, base, onPlayQuestion } = setup();

    act(() => { view.result.current.markTtsFailed(0); });
    expect(view.result.current.hasTtsFailed(0)).toBe(true);
    expect(view.result.current.hasTtsFailed(1)).toBe(false);

    act(() => {
      view.rerender({ ...base, currentIndex: 1, currentQuestion: { source: 'question', question_id: 'q2' } });
    });
    act(() => { jest.advanceTimersByTime(500); });

    expect(onPlayQuestion).toHaveBeenCalled();
  });
});

// ============================================================================
// 재생 완료 → 준비 카운트다운
// ============================================================================

describe('재생 완료', () => {
  it('자동 모드면 준비 카운트다운을 시작한다', () => {
    const { view, base, setSessionState } = setup({ sessionState: 'playing_question' });

    act(() => {
      view.rerender({ ...base, sessionState: 'playing_question' as ExamSessionState, didJustFinish: true });
    });

    expect(setSessionState).toHaveBeenCalledWith('prep_countdown');
    expect(view.result.current.prepCountdown).toBe(3);
  });

  it('수동 모드면 대기 상태로 돌아간다', () => {
    const { view, base, setSessionState } = setup({
      isAutoPlayMode: false,
      sessionState: 'playing_question',
    });

    act(() => {
      view.rerender({
        ...base,
        isAutoPlayMode: false,
        sessionState: 'playing_question' as ExamSessionState,
        didJustFinish: true,
      });
    });

    expect(setSessionState).toHaveBeenCalledWith('ready');
  });

  it('재생 중이 아니면 무시한다 (엉뚱한 시점의 완료 신호)', () => {
    const { view, base, setSessionState } = setup({ sessionState: 'recording' });
    setSessionState.mockClear();

    act(() => {
      view.rerender({ ...base, sessionState: 'recording' as ExamSessionState, didJustFinish: true });
    });

    expect(setSessionState).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 준비 카운트다운 → 녹음
// ============================================================================

describe('준비 카운트다운', () => {
  it('3초를 세고 녹음을 시작한다', () => {
    // ⚠️ 처음부터 prep_countdown 으로 두면 안 된다. prepCountdown 초기값이 0이라
    //    effect 가 곧바로 녹음을 시작한다. 실제 화면은 항상 재생 완료를 거쳐
    //    3으로 진입하므로 그 경로를 그대로 따라간다.
    const { view, base, onStartRecording } = setup({ sessionState: 'ready' });

    act(() => {
      view.rerender({ ...base, sessionState: 'playing_question' as ExamSessionState, didJustFinish: true });
    });
    act(() => {
      view.rerender({ ...base, sessionState: 'prep_countdown' as ExamSessionState, didJustFinish: true });
    });

    expect(view.result.current.prepCountdown).toBe(3);

    tickSeconds(1);
    expect(view.result.current.prepCountdown).toBe(2);
    tickSeconds(1);
    expect(view.result.current.prepCountdown).toBe(1);

    expect(onStartRecording).not.toHaveBeenCalled();

    tickSeconds(1);
    expect(onStartRecording).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// 동의 대기 — "답변 준비 0" 데드락이 났던 지점
// ============================================================================

describe('음성 동의 조회 대기', () => {
  function runToZero(consentStatus: Params['consentStatus']) {
    const ctx = setup({ sessionState: 'ready', consentStatus });
    const { view, base } = ctx;

    act(() => {
      view.rerender({ ...base, consentStatus, sessionState: 'playing_question' as ExamSessionState, didJustFinish: true });
    });
    act(() => {
      view.rerender({ ...base, consentStatus, sessionState: 'prep_countdown' as ExamSessionState, didJustFinish: true });
    });
    tickSeconds(3);

    return ctx;
  }

  it('조회 중이면 카운트다운이 0이 되어도 녹음을 시작하지 않는다', () => {
    const { onStartRecording } = runToZero('loading');

    expect(onStartRecording).not.toHaveBeenCalled();
  });

  it('조회가 끝나면 멈춰 있던 녹음이 이어진다 — 여기가 데드락 지점이었다', () => {
    const { view, base, onStartRecording } = runToZero('loading');

    expect(onStartRecording).not.toHaveBeenCalled();

    act(() => {
      view.rerender({
        ...base,
        consentStatus: 'agreed',
        sessionState: 'prep_countdown' as ExamSessionState,
        didJustFinish: true,
      });
    });

    expect(onStartRecording).toHaveBeenCalledTimes(1);
  });

  it('동의를 거부한 상태여도 시도는 한다 — 모달을 띄우는 것은 화면 몫이다', () => {
    const { onStartRecording } = runToZero('not_agreed');

    expect(onStartRecording).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// 자동 다음 문항
// ============================================================================

describe('답변 종료 → 다음 문항', () => {
  it('1.5초 뒤에 다음 문항으로 넘어간다', () => {
    const { onNextQuestion } = setup({ sessionState: 'between_questions' });

    act(() => { jest.advanceTimersByTime(1400); });
    expect(onNextQuestion).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(200); });
    expect(onNextQuestion).toHaveBeenCalledTimes(1);
  });

  it('수동 모드에서는 자동으로 넘어가지 않는다 — 학생이 버튼을 누른다', () => {
    const { onNextQuestion } = setup({
      sessionState: 'between_questions',
      isAutoPlayMode: false,
    });

    act(() => { jest.advanceTimersByTime(5000); });

    expect(onNextQuestion).not.toHaveBeenCalled();
  });

  it('화면을 벗어나면 예약된 이동을 취소한다', () => {
    const { view, onNextQuestion } = setup({ sessionState: 'between_questions' });

    view.unmount();
    act(() => { jest.advanceTimersByTime(5000); });

    expect(onNextQuestion).not.toHaveBeenCalled();
  });
});
