import { useSegments } from 'expo-router';

/**
 * 현재 라우트 그룹((student) 또는 (teacher))을 감지하여
 * 시험 관련 경로를 동적으로 반환하는 훅.
 *
 * 학생/강사 시험 화면이 동일 컴포넌트를 공유하므로
 * 하드코딩 없이 올바른 라우트 그룹 경로를 생성한다.
 */
export function useExamRoutes() {
  const segments = useSegments();
  const group = segments[0] === '(teacher)' ? '(teacher)' : '(student)';

  return {
    /** 시험 허브 탭: /(group)/(tabs)/exam */
    examHub: `/${group}/(tabs)/exam` as const,
    /** 서베이 전략 가이드: /(group)/exam/survey-guide */
    surveyGuide: `/${group}/exam/survey-guide` as const,
    /** 모의고사 서베이: /(group)/exam/mock-survey */
    mockSurvey: `/${group}/exam/mock-survey` as const,
    /** 모의고사 시작: /(group)/exam/mock-assessment */
    mockAssessment: `/${group}/exam/mock-assessment` as const,
    /** 콤보 롤플레이 목록: /(group)/exam/combo-list */
    comboList: `/${group}/exam/combo-list` as const,
    /** 시험 세션: /(group)/exam/session */
    session: `/${group}/exam/session` as const,
    /** 결과 처리: /(group)/exam/processing */
    processing: `/${group}/exam/processing` as const,
    /** 결과 화면: /(group)/exam/result */
    result: `/${group}/exam/result` as const,
    /** 이력 목록: /(group)/exam/history */
    history: `/${group}/exam/history` as const,
    /** 세션 상세: /(group)/exam/{id} */
    sessionDetail: (id: string) => `/${group}/exam/${id}` as const,
  };
}
