import { supabase } from '@/lib/supabase';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';
import type { StudentTopicWithProgress, TopicQuestionWithScript, TopicGroup, SurveyProfile } from '@/lib/types';

// ============================================================================
// 토픽 그룹 조회
// ============================================================================

/**
 * 활성 토픽 그룹 목록 조회 (Q4~Q7: 여가/취미/운동/휴가)
 */
export async function getTopicGroups(): Promise<{
  data: TopicGroup[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('topic_groups')
    .select('id, name_ko, name_en, selection_type, min_selections, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'topic_group' }) };
  }

  return { data: (data as TopicGroup[]) || [], error: null };
}

// ============================================================================
// 서베이 프로필 (Q1~Q3: 직업/학생/거주지)
// ============================================================================

/**
 * 서베이 프로필 조회
 */
export async function getSurveyProfile(
  studentId: string,
): Promise<{ data: SurveyProfile | null; error: Error | null }> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_survey_profile',
    { p_student_id: studentId },
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'survey_profile' }) };
  }

  const result = data as { success: boolean; profile: SurveyProfile | null; error?: string } | null;
  if (result && !result.success) {
    return {
      data: null,
      error: result.error
        ? classifyRpcError(result.error, { resource: 'survey_profile' })
        : new AppError('SVR_UNKNOWN'),
    };
  }

  return { data: result?.profile || null, error: null };
}

/**
 * 서베이 프로필 저장
 */
export async function saveSurveyProfile(
  studentId: string,
  profile: SurveyProfile,
): Promise<{ error: Error | null }> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'save_survey_profile',
    {
      p_student_id: studentId,
      p_job_type: profile.job_type,
      p_is_student: profile.is_student,
      p_student_type: profile.student_type,
      p_residence_type: profile.residence_type,
    },
  );

  if (error) {
    return { error: classifyError(error, { resource: 'survey_profile' }) };
  }

  const result = data as { success: boolean; error?: string } | null;
  if (result && !result.success) {
    return {
      error: result.error
        ? classifyRpcError(result.error, { resource: 'survey_profile' })
        : new AppError('SVR_UNKNOWN'),
    };
  }

  return { error: null };
}

// ============================================================================
// 토픽 배정
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

  const result = data as { success: boolean; error?: string; detail?: string } | null;
  if (result && !result.success) {
    if (result.detail) {
      return { error: new Error(result.detail) };
    }
    return {
      error: result.error
        ? classifyRpcError(result.error, { resource: 'topic' })
        : new AppError('SVR_UNKNOWN'),
    };
  }

  return { error: null };
}

// ============================================================================
// 학생의 배정 토픽 + 진행 통계 조회
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
