import { supabase } from '@/lib/supabase';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';
import type { StudentTopicWithProgress, TopicQuestionWithScript } from '@/lib/types';

// ============================================================================
// 강사용: 토픽 배정
// ============================================================================

/**
 * 학생에게 토픽 배정 (기존 배정 교체)
 */
export async function setStudentTopics(
  studentId: string,
  topicIds: string[],
): Promise<{ error: Error | null }> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'set_student_topics',
    { p_student_id: studentId, p_topic_ids: topicIds },
  );

  if (error) {
    return { error: classifyError(error, { resource: 'topic' }) };
  }

  const result = data as { success: boolean; error?: string } | null;
  if (result && !result.success) {
    return {
      error: result.error
        ? classifyRpcError(result.error, { resource: 'topic' })
        : new AppError('SVR_UNKNOWN'),
    };
  }

  return { error: null };
}

// ============================================================================
// 강사용: 학생의 배정 토픽 + 진행 통계 조회
// ============================================================================

/**
 * 학생의 배정 토픽 + 진행 통계 조회 (강사가 호출)
 */
export async function getStudentTopicsWithProgress(
  studentId: string,
): Promise<{
  data: StudentTopicWithProgress[] | null;
  error: Error | null;
}> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_student_topics_with_progress',
    { p_student_id: studentId },
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'topic' }) };
  }

  return { data: (data as StudentTopicWithProgress[]) || [], error: null };
}

// ============================================================================
// 학생용: 내 배정 토픽 + 진행 통계 조회
// ============================================================================

/**
 * 내 배정 토픽 + 진행 통계 조회 (학생이 호출)
 */
export async function getMyTopicsWithProgress(): Promise<{
  data: StudentTopicWithProgress[] | null;
  error: Error | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_student_topics_with_progress',
    { p_student_id: user.id },
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'topic' }) };
  }

  return { data: (data as StudentTopicWithProgress[]) || [], error: null };
}

// ============================================================================
// 토픽별 질문 + 스크립트 현황 조회
// ============================================================================

/**
 * 토픽별 질문 + 스크립트/연습 현황 (강사가 호출)
 */
export async function getTopicQuestionsWithScripts(
  studentId: string,
  topicId: string,
): Promise<{
  data: TopicQuestionWithScript[] | null;
  error: Error | null;
}> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_topic_questions_with_scripts',
    { p_student_id: studentId, p_topic_id: topicId },
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'question' }) };
  }

  return { data: (data as TopicQuestionWithScript[]) || [], error: null };
}

/**
 * 내 토픽별 질문 + 스크립트/연습 현황 (학생이 호출)
 */
export async function getMyTopicQuestionsWithScripts(
  topicId: string,
): Promise<{
  data: TopicQuestionWithScript[] | null;
  error: Error | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_topic_questions_with_scripts',
    { p_student_id: user.id, p_topic_id: topicId },
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'question' }) };
  }

  return { data: (data as TopicQuestionWithScript[]) || [], error: null };
}
