import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';

// ============================================================================
// Types
// ============================================================================

type Topic = Database['public']['Tables']['topics']['Row'];
type Question = Database['public']['Tables']['questions']['Row'];
type Script = Database['public']['Tables']['scripts']['Row'];

export interface TopicListItem {
  id: string;
  name_ko: string;
  name_en: string;
  icon: string | null;
  description: string | null;
  category: string;
}

export interface QuestionListItem {
  id: string;
  question_text: string;
  question_type: Database['public']['Enums']['question_type'];
  difficulty: number;
  hint_ko: string | null;
  audio_url: string | null;
}

export interface ScriptDetail {
  id: string;
  content: string;
  comment: string | null;
  status: Database['public']['Enums']['script_status'] | null;
  student_id: string;
  teacher_id: string;
  question: {
    id: string;
    question_text: string;
    question_type: Database['public']['Enums']['question_type'];
    difficulty: number;
    audio_url: string | null;
    topic: {
      id: string;
      name_ko: string;
      name_en: string;
      icon: string | null;
    };
  };
  created_at: string;
  updated_at: string | null;
}

export interface StudentScriptDetail {
  id: string;
  content: string;
  comment: string | null;
  question: {
    id: string;
    question_text: string;
    audio_url: string | null;
    question_type: string | null;
  };
}

// ============================================================================
// 토픽 & 질문 조회 (공용)
// ============================================================================

/**
 * 활성 토픽 목록 조회
 */
export async function getTopics(): Promise<{
  data: TopicListItem[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('topics')
    .select('id, name_ko, name_en, icon, description, category')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return { data: null, error: classifyError(error) };
  }

  return { data: data || [], error: null };
}

/**
 * 토픽별 질문 목록 조회
 */
export async function getQuestionsByTopic(topicId: string): Promise<{
  data: QuestionListItem[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, question_type, difficulty, hint_ko, audio_url')
    .eq('topic_id', topicId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'question' }) };
  }

  return { data: data || [], error: null };
}

// ============================================================================
// 강사용 스크립트 CRUD
// ============================================================================

/**
 * 스크립트 생성 (강사용)
 */
export async function createScript(params: {
  studentId: string;
  questionId: string;
  content: string;
  comment?: string;
}): Promise<{
  data: { id: string } | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  // 연결 검증: 이 학생이 실제로 연결된 학생인지 확인
  const { data: connection } = await supabase
    .from('teacher_student')
    .select('id')
    .eq('teacher_id', user.id)
    .eq('student_id', params.studentId)
    .is('deleted_at', null)
    .single();

  if (!connection) {
    return { data: null, error: new AppError('PERM_NOT_CONNECTED') };
  }

  const { data, error } = await supabase
    .from('scripts')
    .insert({
      student_id: params.studentId,
      teacher_id: user.id,
      question_id: params.questionId,
      content: params.content,
      comment: params.comment || null,
      status: 'complete',
    })
    .select('id')
    .single();

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'script' }) };
  }

  return { data: { id: data.id }, error: null };
}

/**
 * 스크립트 상세 조회 (강사용)
 */
export async function getScript(scriptId: string): Promise<{
  data: ScriptDetail | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase
    .from('scripts')
    .select(`
      id,
      content,
      comment,
      status,
      student_id,
      teacher_id,
      created_at,
      updated_at,
      question:questions!scripts_question_id_fkey (
        id,
        question_text,
        question_type,
        difficulty,
        audio_url,
        topic:topics!questions_topic_id_fkey (
          id,
          name_ko,
          name_en,
          icon
        )
      )
    `)
    .eq('id', scriptId)
    .eq('teacher_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'script' }) };
  }

  // Transform nested data
  const question = data.question as unknown as ScriptDetail['question'];

  return {
    data: {
      id: data.id,
      content: data.content,
      comment: data.comment,
      status: data.status,
      student_id: data.student_id,
      teacher_id: data.teacher_id,
      question,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at,
    },
    error: null,
  };
}

/**
 * 스크립트 수정 (강사용)
 */
export async function updateScript(params: {
  scriptId: string;
  content: string;
  comment?: string;
}): Promise<{
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new AppError('AUTH_REQUIRED') };
  }

  const { error } = await supabase
    .from('scripts')
    .update({
      content: params.content,
      comment: params.comment || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.scriptId)
    .eq('teacher_id', user.id)
    .is('deleted_at', null);

  if (error) {
    return { error: classifyError(error, { resource: 'script' }) };
  }

  return { error: null };
}

/**
 * 스크립트 삭제 (강사용) - Soft Delete
 */
export async function deleteScript(scriptId: string): Promise<{
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('soft_delete_script', {
    p_script_id: scriptId,
  });

  if (error) {
    return { error: classifyError(error, { resource: 'script' }) };
  }

  const result = data as { success: boolean; error?: string } | null;
  if (result && !result.success) {
    return { error: result.error ? classifyRpcError(result.error, { resource: 'script' }) : new AppError('SVR_UNKNOWN') };
  }

  return { error: null };
}

// ============================================================================
// 학생용 스크립트 조회
// ============================================================================

/**
 * 내 스크립트 목록 조회 (학생용)
 */
export async function getMyScripts(): Promise<{
  data: Array<{
    id: string;
    content: string;
    comment: string | null;
    question_text: string;
    topic_name_ko: string;
    topic_icon: string | null;
    created_at: string;
  }> | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase
    .from('scripts')
    .select(`
      id,
      content,
      comment,
      created_at,
      question:questions!scripts_question_id_fkey (
        question_text,
        topic:topics!questions_topic_id_fkey (
          name_ko,
          icon
        )
      )
    `)
    .eq('student_id', user.id)
    .eq('status', 'complete')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'script' }) };
  }

  // Transform data
  const scripts = (data || []).map((script) => {
    const question = script.question as unknown as {
      question_text: string;
      topic: { name_ko: string; icon: string | null };
    };
    return {
      id: script.id,
      content: script.content,
      comment: script.comment,
      question_text: question.question_text,
      topic_name_ko: question.topic.name_ko,
      topic_icon: question.topic.icon,
      created_at: script.created_at || new Date().toISOString(),
    };
  });

  return { data: scripts, error: null };
}

/**
 * 스크립트 상세 조회 (학생용)
 */
export async function getStudentScript(scriptId: string): Promise<{
  data: StudentScriptDetail | null;
  error: Error | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: new AppError('AUTH_REQUIRED') };
    }

    const { data, error } = await supabase
      .from('scripts')
      .select(`
        id,
        content,
        comment,
        question:questions!scripts_question_id_fkey (
          id,
          question_text,
          audio_url,
          question_type
        )
      `)
      .eq('id', scriptId)
      .eq('student_id', user.id)
      .eq('status', 'complete')
      .is('deleted_at', null)
      .single();

    if (error) {
      return { data: null, error: classifyError(error, { resource: 'script' }) };
    }

    const question = data.question as unknown as StudentScriptDetail['question'];

    return {
      data: {
        id: data.id,
        content: data.content,
        comment: data.comment,
        question,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: classifyError(err, { resource: 'script' }) };
  }
}
