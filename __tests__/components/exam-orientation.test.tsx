/**
 * 시험 오리엔테이션 화면 테스트 (컴포넌트)
 *
 * 테스트 로드맵 3단계의 첫 화면이다. 이 화면을 먼저 고른 이유는
 * 이번 세션에 실제로 터진 버그가 여기 있었기 때문이다.
 *
 *   "답변 준비 0" 데드락 — 음성 녹음 동의 모달이 시험 도중 별도 화면에서 뜨려다
 *   렌더링되지 않아, 카운트다운 0에서 영원히 멈췄다. 첫 시험을 보는 모든 학생이
 *   걸렸는데 865개 테스트는 전부 통과했다. 아무도 화면을 그려보지 않았기 때문이다.
 *
 * 그래서 여기서 검증하는 것은 "동의를 받기 전에는 시험이 시작되지 않고,
 * 동의하면 이어서 시작된다"는 상태 전이다.
 */

import { render, screen, fireEvent, act } from '@testing-library/react-native';

// ── 모듈 모킹 ────────────────────────────────────────────────────────────────
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useSegments: () => ['(student)'],
}));

const mockConsent = {
  consentStatus: 'agreed' as 'loading' | 'agreed' | 'not_agreed',
  showConsentModal: false,
  requireConsent: jest.fn(() => true),
  handleAgree: jest.fn(async () => true),
  handleDecline: jest.fn(),
};

jest.mock('@/hooks/useVoiceConsent', () => ({
  useVoiceConsent: () => mockConsent,
}));

import OrientationScreen from '@/app/(student)/exam/orientation';


/** 카운트다운은 매 초 새 타이머를 건다. 한 번에 넘기면 effect 가 따라오지 못한다 */
function runCountdown(seconds = 3) {
  for (let i = 0; i < seconds; i++) {
    act(() => { jest.advanceTimersByTime(1000); });
  }
}

const QUESTIONS = JSON.stringify([
  { question_id: 'q1', question_text: 'Tell me about yourself' },
  { question_id: 'q2', question_text: 'Describe your home' },
]);

function setParams(extra: Record<string, string> = {}) {
  mockParams = {
    sessionId: 'session-1',
    examType: 'mock_exam',
    questions: QUESTIONS,
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  setParams();
  mockConsent.consentStatus = 'agreed';
  mockConsent.showConsentModal = false;
  mockConsent.requireConsent = jest.fn(() => true);
  mockConsent.handleAgree = jest.fn(async () => true);
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// 화면이 그려지는가
// ============================================================================

describe('오리엔테이션 표시', () => {
  it('시험 안내와 문항 수를 보여준다', () => {
    render(<OrientationScreen />);

    expect(screen.getByText(/오리엔테이션/)).toBeTruthy();
    expect(screen.getByText('2문항')).toBeTruthy();
  });

  it('자동 진행 방식임을 알린다 — 학생이 놀라지 않도록', () => {
    render(<OrientationScreen />);

    expect(screen.getByText('질문 자동 재생')).toBeTruthy();
    expect(screen.getByText('자동 녹음 시작')).toBeTruthy();
  });

  it('문항 데이터가 깨져 있어도 화면이 죽지 않는다', () => {
    setParams({ questions: 'not-json' });

    expect(() => render(<OrientationScreen />)).not.toThrow();
    expect(screen.getByText('0문항')).toBeTruthy();
  });
});

// ============================================================================
// 동의 게이트 — 여기가 데드락이 났던 지점
// ============================================================================

describe('음성 녹음 동의', () => {
  it('동의가 끝난 학생은 바로 카운트다운으로 넘어간다', () => {
    render(<OrientationScreen />);

    fireEvent.press(screen.getByText('시험 시작'));

    expect(screen.getByText('시험이 곧 시작됩니다')).toBeTruthy();
  });

  it('동의 전이면 카운트다운이 시작되지 않는다', () => {
    mockConsent.requireConsent = jest.fn(() => false);
    render(<OrientationScreen />);

    fireEvent.press(screen.getByText('시험 시작'));

    // 카운트다운 화면으로 넘어가지 않고 오리엔테이션에 머문다
    expect(screen.queryByText('시험이 곧 시작됩니다')).toBeNull();
    expect(mockConsent.requireConsent).toHaveBeenCalled();
  });

  it('동의가 끝나면 버튼을 다시 누르지 않아도 카운트다운이 이어진다', () => {
    // 아직 동의하지 않은 학생 → 시작 요청이 보류된다
    mockConsent.consentStatus = 'not_agreed';
    mockConsent.requireConsent = jest.fn(() => false);
    const view = render(<OrientationScreen />);

    fireEvent.press(screen.getByText('시험 시작'));
    expect(screen.queryByText('시험이 곧 시작됩니다')).toBeNull();

    // 모달에서 동의 → consentStatus 가 agreed 로 바뀐다
    mockConsent.consentStatus = 'agreed';
    act(() => { view.rerender(<OrientationScreen />); });

    // 보류됐던 요청이 이어져 카운트다운이 시작된다 (버튼을 다시 누르지 않았다)
    expect(screen.getByText('시험이 곧 시작됩니다')).toBeTruthy();
  });

  it('동의 상태를 확인하는 중에는 버튼을 누를 수 없다', () => {
    mockConsent.consentStatus = 'loading';
    render(<OrientationScreen />);

    // 확인 중 문구로 바뀌고, 시험 시작 라벨은 없다
    expect(screen.getByText('확인 중...')).toBeTruthy();
    expect(screen.queryByText('시험 시작')).toBeNull();
  });
});

// ============================================================================
// 카운트다운 → 세션 이동
// ============================================================================

describe('카운트다운', () => {
  it('3초를 세고 시험 세션으로 이동한다', async () => {
    render(<OrientationScreen />);
    fireEvent.press(screen.getByText('시험 시작'));

    expect(screen.getByText('3')).toBeTruthy();

    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('2')).toBeTruthy();

    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('1')).toBeTruthy();

    act(() => { jest.advanceTimersByTime(1000); });

    expect(mockReplace).toHaveBeenCalled();
  });

  it('세션으로 넘길 때 autoPlay 를 켠다 — 이게 없으면 자동 진행이 안 된다', async () => {
    render(<OrientationScreen />);
    fireEvent.press(screen.getByText('시험 시작'));

    runCountdown();

    expect(mockReplace).toHaveBeenCalled();
    const url = mockReplace.mock.calls[0][0] as string;
    expect(url).toContain('autoPlay=true');
    expect(url).toContain('sessionId=session-1');
    expect(url).toContain('examType=mock_exam');
  });

  it('롤플레이 시나리오 설명이 있으면 함께 넘긴다', async () => {
    setParams({ examType: 'combo_roleplay', scenarioContext: '호텔 예약 상황' });
    render(<OrientationScreen />);
    fireEvent.press(screen.getByText('시험 시작'));

    runCountdown();

    expect(mockReplace).toHaveBeenCalled();
    expect(mockReplace.mock.calls[0][0]).toContain('scenarioContext=');
  });

  it('카운트다운 중에는 시험을 시작하기 전 화면으로 돌아가지 않는다', () => {
    render(<OrientationScreen />);
    fireEvent.press(screen.getByText('시험 시작'));

    // 뒤로 버튼은 오리엔테이션 화면에만 있다
    expect(screen.queryByText('뒤로')).toBeNull();
  });
});
