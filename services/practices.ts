import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { AIFeedback, StudentPracticeStats } from '@/lib/types';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';

// ============================================================================
// Types
// ============================================================================

export interface PracticeResult {
  id: string;
  script_id: string;
  audio_url: string | null;
  transcription: string | null;
  score: number | null;
  reproduction_rate: number | null;
  feedback: AIFeedback | null;
  duration: number | null;
  created_at: string;
  script_content: string;
  question_text: string;
}

/** 강사용 연습 상세 (학생 정보 + 강사 피드백 포함) */
export interface PracticeDetailForTeacher {
  id: string;
  script_id: string;
  audio_url: string | null;
  transcription: string | null;
  score: number | null;
  reproduction_rate: number | null;
  feedback: AIFeedback | null;
  duration: number | null;
  created_at: string;
  script_content: string;
  question_text: string;
  topic_name_ko: string;
  student: {
    id: string;
    name: string;
    email: string;
  };
  teacher_feedback: {
    id: string;
    feedback: string;
    created_at: string;
  } | null;
}

export interface CreatePracticeParams {
  scriptId: string;
  audioPath: string;  // Storage 파일 경로 (예: {user_id}/{filename})
  duration: number;
}

export interface UpdatePracticeWithFeedbackParams {
  practiceId: string;
  transcription: string;
  score: number;
  reproductionRate: number;
  feedback: AIFeedback;
}

// ============================================================================
// 학생용 함수
// ============================================================================

/**
 * 연습 기록 생성 (녹음 완료 시)
 */
export async function createPractice(params: CreatePracticeParams): Promise<{
  data: { id: string } | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase
    .from('practices')
    .insert({
      student_id: user.id,
      script_id: params.scriptId,
      audio_url: params.audioPath,  // 파일 경로 저장 (조회 시 signedUrl 생성)
      duration: params.duration,
    })
    .select('id')
    .single();

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'practice' }) };
  }

  return { data: { id: data.id }, error: null };
}

/**
 * 연습 결과 업데이트 (STT + AI 피드백 완료 시)
 */
export async function updatePracticeWithFeedback(
  params: UpdatePracticeWithFeedbackParams
): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new AppError('AUTH_REQUIRED') };
  }

  const { error } = await supabase
    .from('practices')
    .update({
      transcription: params.transcription,
      score: params.score,
      reproduction_rate: params.reproductionRate,
      feedback: params.feedback as unknown as Database['public']['Tables']['practices']['Update']['feedback'],
    })
    .eq('id', params.practiceId)
    .eq('student_id', user.id);

  if (error) {
    return { error: classifyError(error, { resource: 'practice' }) };
  }

  return { error: null };
}

/**
 * 연습 결과 조회 (학생용)
 */
export async function getPracticeResult(practiceId: string): Promise<{
  data: PracticeResult | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase
    .from('practices')
    .select(`
      id,
      script_id,
      audio_url,
      transcription,
      score,
      reproduction_rate,
      feedback,
      duration,
      created_at,
      script:scripts!practices_script_id_fkey (
        content,
        question:questions!scripts_question_id_fkey (
          question_text
        )
      )
    `)
    .eq('id', practiceId)
    .eq('student_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'practice' }) };
  }

  const script = data.script as unknown as {
    content: string;
    question: { question_text: string };
  };

  // audio_url이 경로인 경우 signedUrl 생성
  let audioUrl: string | null = null;
  if (data.audio_url) {
    const { data: signedData, error: signedUrlError } = await supabase.storage
      .from('practice-recordings')
      .createSignedUrl(data.audio_url, 3600); // 1시간 유효
    if (signedUrlError && __DEV__) {
      console.warn('[AppError] SVR_STORAGE_URL:', signedUrlError.message);
    }
    audioUrl = signedData?.signedUrl || null;
  }

  return {
    data: {
      id: data.id,
      script_id: data.script_id,
      audio_url: audioUrl,
      transcription: data.transcription,
      score: data.score,
      reproduction_rate: data.reproduction_rate,
      feedback: data.feedback as unknown as AIFeedback | null,
      duration: data.duration,
      created_at: data.created_at || new Date().toISOString(),
      script_content: script.content,
      question_text: script.question.question_text,
    },
    error: null,
  };
}

/**
 * 내 연습 기록 목록 조회 (학생용)
 */
export async function getMyPractices(): Promise<{
  data: Array<{
    id: string;
    score: number | null;
    reproduction_rate: number | null;
    duration: number | null;
    created_at: string;
    question_text: string;
    topic_name_ko: string;
  }> | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase
    .from('practices')
    .select(`
      id,
      score,
      reproduction_rate,
      duration,
      created_at,
      script:scripts!practices_script_id_fkey (
        question:questions!scripts_question_id_fkey (
          question_text,
          topic:topics!questions_topic_id_fkey (
            name_ko
          )
        )
      )
    `)
    .eq('student_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'practice' }) };
  }

  const practices = (data || []).map((practice) => {
    const script = practice.script as unknown as {
      question: {
        question_text: string;
        topic: { name_ko: string };
      };
    };
    return {
      id: practice.id,
      score: practice.score,
      reproduction_rate: practice.reproduction_rate,
      duration: practice.duration,
      created_at: practice.created_at || new Date().toISOString(),
      question_text: script.question.question_text,
      topic_name_ko: script.question.topic.name_ko,
    };
  });

  return { data: practices, error: null };
}

/**
 * 내 연습 통계 조회 (학생용)
 * get_student_practice_stats RPC를 본인 ID로 호출
 */
export async function getMyPracticeStats(): Promise<{
  data: StudentPracticeStats | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase.rpc('get_student_practice_stats', {
    p_student_id: user.id,
  });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'practice' }) };
  }

  const result = data as unknown as StudentPracticeStats & { error?: string };
  if (result?.error) {
    return { data: null, error: classifyRpcError(result.error, { resource: 'practice' }) };
  }

  return { data: result, error: null };
}

/**
 * 내 연습 스트릭 조회 (학생용)
 * get_practice_streak RPC를 본인 ID로 호출
 *
 */
export async function getMyStreak(): Promise<{
  data: { current_streak: number } | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  const { data, error } = await supabase.rpc(
    'get_practice_streak',
    { p_student_id: user.id }
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'practice' }) };
  }

  const result = data as { current_streak?: number; error?: string } | null;
  if (result?.error) {
    return { data: null, error: classifyRpcError(result.error, { resource: 'practice' }) };
  }

  return {
    data: { current_streak: result?.current_streak ?? 0 },
    error: null,
  };
}

// ============================================================================
// 강사용 함수
// ============================================================================

/**
 * 연습 결과 조회 (강사용)
 * - 연결된 학생의 연습 기록만 조회 가능
 * - 강사 피드백 포함
 */
export async function getPracticeForTeacher(practiceId: string): Promise<{
  data: PracticeDetailForTeacher | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  // 연습 기록 조회 (인가: 쿼리 레벨에서 teacher_id 필터링)
  // !inner JOIN + .eq('script.teacher_id') → 권한 없는 데이터는 아예 조회되지 않음
  const { data, error } = await supabase
    .from('practices')
    .select(`
      id,
      script_id,
      student_id,
      audio_url,
      transcription,
      score,
      reproduction_rate,
      feedback,
      duration,
      created_at,
      student:users!practices_student_id_fkey (
        id,
        name,
        email
      ),
      script:scripts!practices_script_id_fkey!inner (
        content,
        teacher_id,
        question:questions!scripts_question_id_fkey (
          question_text,
          topic:topics!questions_topic_id_fkey (
            name_ko
          )
        )
      ),
      teacher_feedback:teacher_feedbacks!teacher_feedbacks_practice_id_fkey (
        id,
        feedback,
        created_at
      )
    `)
    .eq('id', practiceId)
    .eq('script.teacher_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'practice' }) };
  }

  const script = data.script as unknown as {
    content: string;
    teacher_id: string;
    question: {
      question_text: string;
      topic: { name_ko: string };
    };
  };

  const student = data.student as unknown as {
    id: string;
    name: string;
    email: string;
  };

  const teacherFeedback = data.teacher_feedback as unknown as {
    id: string;
    feedback: string;
    created_at: string;
  }[] | null;

  // audio_url이 경로인 경우 signedUrl 생성
  let audioUrl: string | null = null;
  if (data.audio_url) {
    const { data: signedData, error: signedUrlError } = await supabase.storage
      .from('practice-recordings')
      .createSignedUrl(data.audio_url, 3600);
    if (signedUrlError && __DEV__) {
      console.warn('[AppError] SVR_STORAGE_URL:', signedUrlError.message);
    }
    audioUrl = signedData?.signedUrl || null;
  }

  return {
    data: {
      id: data.id,
      script_id: data.script_id,
      audio_url: audioUrl,
      transcription: data.transcription,
      score: data.score,
      reproduction_rate: data.reproduction_rate,
      feedback: data.feedback as unknown as AIFeedback | null,
      duration: data.duration,
      created_at: data.created_at || new Date().toISOString(),
      script_content: script.content,
      question_text: script.question.question_text,
      topic_name_ko: script.question.topic.name_ko,
      student,
      teacher_feedback: teacherFeedback && teacherFeedback.length > 0
        ? teacherFeedback[0]
        : null,
    },
    error: null,
  };
}

/**
 * 강사 피드백 작성/수정 (Upsert)
 * - practice_id당 하나의 피드백만 가능 (UNIQUE 제약)
 * - TOCTOU 방지: SELECT→INSERT/UPDATE 대신 단일 UPSERT 사용
 */
export async function saveTeacherFeedback(params: {
  practiceId: string;
  feedback: string;
}): Promise<{
  data: { id: string } | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  // 인가 확인: !inner JOIN으로 본인 스크립트의 연습만 조회 가능
  const { data: practice, error: practiceError } = await supabase
    .from('practices')
    .select(`
      id,
      script:scripts!practices_script_id_fkey!inner (
        teacher_id
      )
    `)
    .eq('id', params.practiceId)
    .eq('script.teacher_id', user.id)
    .is('deleted_at', null)
    .single();

  if (practiceError || !practice) {
    return { data: null, error: practiceError ? classifyError(practiceError, { resource: 'practice' }) : new AppError('NF_PRACTICE') };
  }

  // 원자적 UPSERT: SELECT→INSERT/UPDATE TOCTOU 제거
  // practice_id UNIQUE 제약에 의해 ON CONFLICT 동작
  const { data: feedbackData, error: upsertError } = await supabase
    .from('teacher_feedbacks')
    .upsert(
      {
        practice_id: params.practiceId,
        teacher_id: user.id,
        feedback: params.feedback,
      },
      { onConflict: 'practice_id' }
    )
    .select('id')
    .single();

  if (upsertError) {
    return { data: null, error: classifyError(upsertError, { resource: 'practice' }) };
  }

  return { data: { id: feedbackData.id }, error: null };
}

// ============================================================================
// AI 연동 (Edge Function)
// ============================================================================

/**
 * STT 변환 (Whisper API via Edge Function)
 */
export async function transcribeAudio(audioPath: string): Promise<{
  data: { transcription: string } | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('whisper-stt', {
      body: { audioPath },
    });

    if (error) {
      return { data: null, error: classifyError(error, { apiType: 'whisper' }) };
    }

    if (data?.error) {
      return { data: null, error: classifyError(data.error, { apiType: 'whisper' }) };
    }

    return {
      data: { transcription: data.transcription || '' },
      error: null,
    };
  } catch (err) {
    return { data: null, error: classifyError(err, { apiType: 'whisper' }) };
  }
}

/**
 * AI 피드백 생성 (Claude Haiku via Edge Function)
 * @param questionType - 질문 유형 (describe, routine 등) — 선택적 컨텍스트
 */
export async function generateFeedback(
  scriptContent: string,
  transcription: string,
  questionType?: string | null,
): Promise<{
  data: {
    score: number;
    reproductionRate: number;
    feedback: AIFeedback;
  } | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('claude-feedback', {
      body: { scriptContent, transcription, questionType: questionType || undefined },
    });

    if (error) {
      return { data: null, error: classifyError(error, { apiType: 'claude' }) };
    }

    if (data?.error) {
      return { data: null, error: classifyError(data.error, { apiType: 'claude' }) };
    }

    return {
      data: {
        score: data.score ?? 0,
        reproductionRate: data.reproductionRate ?? 0,
        feedback: data.feedback as AIFeedback,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: classifyError(err, { apiType: 'claude' }) };
  }
}

// ============================================================================
// TTS 함수
// ============================================================================

/**
 * 질문 오디오 생성 (TTS via Edge Function)
 * - 캐싱: 이미 생성된 오디오가 있으면 바로 반환
 * - question_text는 서버가 DB에서 직접 조회 (클라이언트 텍스트 주입 방지)
 */
export async function generateQuestionAudio(
  questionId: string,
): Promise<{
  data: { audioUrl: string; cached: boolean } | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('tts-generate', {
      body: { questionId },
    });

    if (error) {
      return { data: null, error: classifyError(error, { apiType: 'tts' }) };
    }

    if (data?.error) {
      return { data: null, error: classifyError(data.error, { apiType: 'tts' }) };
    }

    return {
      data: {
        audioUrl: data.audioUrl,
        cached: data.cached ?? false,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: classifyError(err, { apiType: 'tts' }) };
  }
}

/**
 * 스크립트 오디오 생성 (TTS via Edge Function)
 * - 쉐도잉 연습용: 스크립트 내용을 네이티브 발음으로 읽어줌
 * - 서버에서 scriptId로 content 조회 (텍스트 주입 방지)
 * - Storage 기반 캐싱 (scripts/{scriptId}.mp3)
 */
export async function generateScriptAudio(
  scriptId: string,
): Promise<{
  data: { audioUrl: string; cached: boolean } | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('tts-generate', {
      body: { scriptId },
    });

    if (error) {
      return { data: null, error: classifyError(error, { apiType: 'tts' }) };
    }

    if (data?.error) {
      return { data: null, error: classifyError(data.error, { apiType: 'tts' }) };
    }

    return {
      data: {
        audioUrl: data.audioUrl,
        cached: data.cached ?? false,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: classifyError(err, { apiType: 'tts' }) };
  }
}

// ============================================================================
// Storage 함수
// ============================================================================

/**
 * 녹음 파일 업로드
 * - FormData로 로컬 파일 업로드 (React Native 표준 방식)
 * @returns 파일 경로 (예: {user_id}/{filename}) - DB에 저장용
 */
export async function uploadRecording(
  uri: string,
  fileName: string
): Promise<{
  data: { path: string } | null;
  error: Error | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: new AppError('AUTH_REQUIRED') };
    }

    const filePath = `${user.id}/${fileName}`;

    // React Native FormData: URI를 직접 전달 (fetch/FileSystem 불필요)
    const formData = new FormData();
    formData.append('', {
      uri,
      name: fileName,
      type: 'audio/m4a',
    } as any);

    const { error: uploadError } = await supabase.storage
      .from('practice-recordings')
      .upload(filePath, formData, {
        contentType: 'multipart/form-data',
        upsert: false,
      });

    if (uploadError) {
      return { data: null, error: classifyError(uploadError, { resource: 'audio' }) };
    }

    // 경로만 반환 (조회 시 signedUrl 생성)
    return { data: { path: filePath }, error: null };
  } catch (err) {
    return { data: null, error: classifyError(err, { resource: 'audio' }) };
  }
}
