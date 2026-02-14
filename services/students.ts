import { supabase } from '@/lib/supabase';
import type {
  StudentWithStats,
  StudentPracticeStats,
  TeacherStudentListItem,
  StudentScriptListItem,
  StudentPracticeListItem,
  StudentDetailResult,
  OpicGrade,
} from '@/lib/types';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';

// ============================================================================
// 강사용 함수
// ============================================================================

/**
 * 연결된 학생 목록 조회 (강사용)
 *
 * RPC 함수 get_teacher_students를 호출하여 학생 목록과 통계를 한 번에 조회합니다.
 * - N+1 쿼리 문제 해결
 * - deleted_at 조건 서버에서 일괄 적용
 * - 016: this_week_practices, pending_feedback_count 포함
 *
 * TeacherStudentListItem: database.types.ts 재생성 전 임시 타입
 */
export async function getConnectedStudents(): Promise<{
  data: TeacherStudentListItem[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('get_teacher_students');

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'student' }) };
  }

  return { data: data || [], error: null };
}

/**
 * 학생 상세 정보 조회 (강사용) - 레거시 버전
 * 학생의 기본 정보와 통계를 함께 조회합니다.
 *
 * @deprecated getStudentDetail(RPC 버전)을 사용하세요
 */
export async function getStudentDetails(studentId: string): Promise<{
  data: StudentWithStats | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  // 연결 확인
  const { data: connection } = await supabase
    .from('teacher_student')
    .select('id')
    .eq('teacher_id', user.id)
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .single();

  if (!connection) {
    return { data: null, error: new AppError('PERM_NOT_CONNECTED') };
  }

  // 학생 정보 조회
  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('*')
    .eq('id', studentId)
    .is('deleted_at', null)
    .single();

  if (studentError || !student) {
    return { data: null, error: studentError ? classifyError(studentError, { resource: 'student' }) : new AppError('NF_STUDENT') };
  }

  // 통계 조회 (RPC 함수 사용 - deleted_at 조건 포함)
  const { data: stats, error: statsError } = await supabase.rpc('get_student_practice_stats', { p_student_id: studentId });
  if (statsError && __DEV__) {
    console.warn('[AppError] stats RPC failed:', statsError.message);
  }

  // 스크립트 수 (해당 강사가 작성한 것만)
  const { count: scriptsCount } = await supabase
    .from('scripts')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('teacher_id', user.id)
    .is('deleted_at', null);

  // 연습 수
  const { count: practicesCount } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .is('deleted_at', null);

  return {
    data: {
      ...student,
      stats: stats as unknown as StudentPracticeStats | undefined,
      scripts_count: scriptsCount || 0,
      practices_count: practicesCount || 0,
    },
    error: null,
  };
}

/**
 * 학생 연결 해제 (강사용)
 * Soft delete로 연결을 해제합니다.
 */
export async function disconnectStudent(studentId: string): Promise<{
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: new AppError('AUTH_REQUIRED') };
  }

  // 연결 찾기
  const { data: connection, error: findError } = await supabase
    .from('teacher_student')
    .select('id')
    .eq('teacher_id', user.id)
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .single();

  if (findError || !connection) {
    return { error: findError ? classifyError(findError, { resource: 'connection' }) : new AppError('NF_CONNECTION') };
  }

  // Soft delete (RPC 함수 사용)
  const { data, error } = await supabase.rpc('soft_delete_connection', { p_connection_id: connection.id });

  if (error) {
    return { error: classifyError(error, { resource: 'connection' }) };
  }

  const result = data as { success: boolean; error?: string } | null;
  if (result && !result.success) {
    return { error: result.error ? classifyRpcError(result.error, { resource: 'connection' }) : new AppError('SVR_UNKNOWN') };
  }

  return { error: null };
}

// ============================================================================
// 학생 상세 화면용 함수 (RPC 기반)
// ============================================================================

/**
 * 학생 상세 정보 조회 (RPC 사용)
 *
 * get_student_detail RPC를 호출하여 학생 기본 정보와 통계를 한 번에 조회합니다.
 * - 서버에서 권한 검증 (강사-학생 연결 확인)
 * - 이 강사가 작성한 스크립트 기준 통계
 */
export async function getStudentDetail(studentId: string): Promise<{
  data: StudentDetailResult | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('get_student_detail', {
    p_student_id: studentId,
  });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'student' }) };
  }

  const result = data as unknown as StudentDetailResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'student' }).userMessage;
  }
  return { data: result, error: null };
}

/**
 * 학생의 스크립트 목록 조회 (강사용)
 *
 * get_student_scripts RPC를 호출하여 특정 학생의 스크립트 목록을 조회합니다.
 * - 질문/토픽 정보 포함
 * - 연습 통계 포함 (연습 횟수, 최고 점수, 최고 재현율)
 * - deleted_at 조건 서버에서 일괄 적용
 */
export async function getStudentScripts(studentId: string): Promise<{
  data: StudentScriptListItem[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('get_student_scripts', {
    p_student_id: studentId,
  });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'script' }) };
  }

  return { data: data || [], error: null };
}

/**
 * 학생의 연습 기록 목록 조회 (강사용)
 *
 * get_student_practices RPC를 호출하여 특정 학생의 연습 기록을 조회합니다.
 * - 스크립트/질문/토픽 정보 포함
 * - 강사 피드백 포함
 * - deleted_at 조건 서버에서 일괄 적용
 */
export async function getStudentPractices(studentId: string): Promise<{
  data: StudentPracticeListItem[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('get_student_practices', {
    p_student_id: studentId,
  });

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'practice' }) };
  }

  return { data: data || [], error: null };
}

// ============================================================================
// 학생 메모/목표 설정 (강사용)
// ============================================================================

/**
 * 학생 메모 및 목표 등급 저장 (강사용)
 *
 * update_student_notes RPC 호출 (SECURITY DEFINER)
 * - teacher_student에 UPDATE RLS 없으므로 RPC로만 수정 가능
 * - target_opic_grade: 화이트리스트 검증 (서버)
 * - notes: 2000자 제한 (서버)
 * - COALESCE로 부분 업데이트 지원 (null 전달 시 기존 값 유지)
 *
 */
export async function updateStudentNotes(params: {
  studentId: string;
  notes?: string | null;
  targetGrade?: OpicGrade | null;
}): Promise<{
  error: Error | null;
}> {
  // 규약: undefined → 파라미터 생략 (변경 없음), null → '' (비우기), 값 → 값 (설정)
  const rpcParams: {
    p_student_id: string;
    p_notes?: string;
    p_target_grade?: string;
  } = { p_student_id: params.studentId };

  if (params.notes !== undefined) {
    rpcParams.p_notes = params.notes || '';
  }
  if (params.targetGrade !== undefined) {
    rpcParams.p_target_grade = params.targetGrade || '';
  }

  const { data, error } = await supabase.rpc('update_student_notes', rpcParams);

  if (error) {
    return { error: classifyError(error, { resource: 'student' }) };
  }

  const result = data as { success: boolean; error?: string } | null;
  if (result && !result.success && result.error) {
    return { error: classifyRpcError(result.error, { resource: 'student' }) };
  }

  return { error: null };
}
