import ExamResultScreen from './result';

/**
 * 과거 시험 결과 상세 — result.tsx와 동일한 화면을 재사용
 * 라우트: /(student)/exam/[sessionId]
 * result.tsx가 useLocalSearchParams로 sessionId를 읽음
 * [sessionId] 동적 라우트 세그먼트가 자동으로 sessionId 파라미터가 됨
 */
export default function ExamSessionDetailScreen() {
  return <ExamResultScreen />;
}
