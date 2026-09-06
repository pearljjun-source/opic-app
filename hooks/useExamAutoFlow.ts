import { useEffect, useRef, useState, useCallback } from 'react';

import { EXAM_CONFIG } from '@/lib/constants';

// ============================================================================
// 시험 자동 모드(CBT) 상태 전이
//
// 실제 OPIc 처럼 질문이 자동 재생되고, 끝나면 준비 시간을 세고, 녹음이 자동으로
// 시작되고, 답변이 끝나면 다음 문항으로 넘어간다.
//
//   ready → playing_question → prep_countdown → recording → between_questions → ready
//
// 왜 화면에서 꺼냈나:
//   session.tsx 는 1,165줄에 expo-audio·훅 5개·서비스 2개를 물고 있어서, 이 전이를
//   검증하려면 화면 전체를 모킹해야 했다. 그렇게 만든 테스트는 화면 구현에 묶여
//   리팩터링마다 깨진다. 전이 자체는 오디오나 렌더링과 무관하므로 여기로 옮긴다.
//
// 여기서 실제로 났던 버그 둘:
//   1. TTS 재생이 실패하면 상태가 ready 로 돌아가고, 자동 재생 effect 가 다시 돌아
//      0.5초마다 재시도했다. 알림이 쌓이고 TTS 쿼터가 25초면 소진됐다.
//   2. 동의 조회가 끝나기 전에 카운트다운이 0이 되면 녹음이 시작되지 않고 멈췄다.
//      "답변 준비 0" 에서 영원히 정지했다.
// ============================================================================

export type ExamSessionState =
  | 'loading'
  | 'ready'
  | 'playing_question'
  | 'prep_countdown'
  | 'recording'
  | 'between_questions'
  | 'exam_end';

/** 자동 재생 대상 문항인지 판단하는 데 필요한 최소 정보 */
export interface AutoFlowQuestion {
  source?: string | null;
  question_id?: string | null;
}

export interface UseExamAutoFlowParams {
  /** 오리엔테이션을 거쳐 들어온 자동 진행 모드인지 */
  isAutoPlayMode: boolean;
  sessionState: ExamSessionState;
  setSessionState: (s: ExamSessionState) => void;
  currentIndex: number;
  currentQuestion: AutoFlowQuestion | undefined | null;
  /** 음성 녹음 동의 조회 상태. 'loading' 이면 녹음 시작을 미룬다 */
  consentStatus: 'loading' | 'agreed' | 'not_agreed';
  /** expo-audio 의 재생 완료 신호 */
  didJustFinish: boolean;

  /** 질문 음성 재생 (실패 시 markTtsFailed 를 부르는 쪽은 호출자다) */
  onPlayQuestion: () => void;
  /** 녹음 시작 */
  onStartRecording: () => void;
  /** 다음 문항으로 */
  onNextQuestion: () => void;
}

/** 준비 카운트다운 시작 값(초) */
const PREP_SECONDS = 3;

export function useExamAutoFlow({
  isAutoPlayMode,
  sessionState,
  setSessionState,
  currentIndex,
  currentQuestion,
  consentStatus,
  didJustFinish,
  onPlayQuestion,
  onStartRecording,
  onNextQuestion,
}: UseExamAutoFlowParams) {
  const [prepCountdown, setPrepCountdown] = useState(0);

  /** TTS 재생에 실패한 문항 index — 무한 재시도를 막는다 */
  const ttsFailedRef = useRef<Set<number>>(new Set());

  // 콜백은 매 렌더 새로 만들어지므로 ref 로 잡아 둔다.
  // 의존성에 넣으면 타이머가 매 렌더 재설정되어 카운트다운이 멈춘다.
  const playRef = useRef(onPlayQuestion);
  const recordRef = useRef(onStartRecording);
  const nextRef = useRef(onNextQuestion);
  useEffect(() => { playRef.current = onPlayQuestion; });
  useEffect(() => { recordRef.current = onStartRecording; });
  useEffect(() => { nextRef.current = onNextQuestion; });

  /**
   * 이 문항의 TTS 재생이 실패했다고 기록한다.
   * 화면의 재생 함수가 실패 경로에서 부른다.
   */
  const markTtsFailed = useCallback((index: number) => {
    ttsFailedRef.current.add(index);
  }, []);

  /** 이 문항에서 이미 재생이 실패했는지 */
  const hasTtsFailed = useCallback((index: number) => ttsFailedRef.current.has(index), []);

  const goToPrep = useCallback(() => {
    setSessionState('prep_countdown');
    setPrepCountdown(PREP_SECONDS);
  }, [setSessionState]);

  // ── 1. 재생 완료 → 준비 카운트다운 (수동 모드는 대기 상태로) ────────────────
  useEffect(() => {
    if (!didJustFinish || sessionState !== 'playing_question') return;

    if (isAutoPlayMode) {
      goToPrep();
    } else {
      setSessionState('ready');
    }
    // sessionState 를 의존성에 넣으면 재생 중 상태 변화마다 재실행된다.
    // didJustFinish 가 신호이므로 그것만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [didJustFinish]);

  // ── 2. 준비 카운트다운 → 0 이 되면 녹음 시작 ────────────────────────────────
  //
  // ⚠️ consentStatus 를 의존성에 둔다. 동의 조회가 늦게 끝나도 완료 시점에 effect 가
  //    다시 돌아 녹음을 재개한다. 이게 없으면 "답변 준비 0" 에서 영원히 멈춘다.
  useEffect(() => {
    if (sessionState !== 'prep_countdown') return;

    if (prepCountdown <= 0) {
      if (consentStatus === 'loading') return;  // 조회 완료 후 재실행된다
      recordRef.current();
      return;
    }

    const timer = setTimeout(() => setPrepCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [sessionState, prepCountdown, consentStatus]);

  // ── 3. ready 진입 → 자동 재생 ───────────────────────────────────────────────
  //
  // ⚠️ 이 effect 는 sessionState 가 'ready' 가 될 때마다 돈다. 재생이 실패하면
  //    화면이 상태를 'ready' 로 되돌리므로, 실패를 기록해 두지 않으면 0.5초마다
  //    재시도하는 무한 루프가 된다. 한 문항당 한 번만 시도하고, 실패하면 음성 없이
  //    답변 단계로 넘어간다 — 질문 글은 화면에 있으므로 시험은 계속할 수 있다.
  useEffect(() => {
    if (!isAutoPlayMode || sessionState !== 'ready' || !currentQuestion) return;

    // 롤플레이 질문은 TTS 대상이 아니다 (question_id 가 없다)
    if (currentQuestion.source !== 'question' || !currentQuestion.question_id) {
      goToPrep();
      return;
    }

    if (ttsFailedRef.current.has(currentIndex)) {
      goToPrep();
      return;
    }

    const timer = setTimeout(() => playRef.current(), EXAM_CONFIG.AUTO_PLAY_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, currentIndex, isAutoPlayMode]);

  // ── 4. 답변 종료 → 다음 문항 ────────────────────────────────────────────────
  useEffect(() => {
    if (!isAutoPlayMode || sessionState !== 'between_questions') return;

    const timer = setTimeout(() => nextRef.current(), EXAM_CONFIG.QUESTION_TRANSITION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [sessionState, isAutoPlayMode]);

  return {
    /** 준비 카운트다운 남은 초 */
    prepCountdown,
    /** 화면의 재생 실패 경로에서 호출한다 */
    markTtsFailed,
    hasTtsFailed,
    /** 문항이 바뀌지 않은 채 준비 단계로 보낼 때 (화면에서 직접 쓰지 않는다) */
    goToPrep,
  };
}
