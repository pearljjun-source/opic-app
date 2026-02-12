import { supabase } from '@/lib/supabase';
import type { User } from '@/lib/types';
import { AppError, classifyError } from '@/lib/errors';

// ============================================================================
// Types
// ============================================================================

export interface ConnectedTeacher {
  id: string;
  name: string;
  email: string;
  connected_at: string;
}

// ============================================================================
// 학생용 함수
// ============================================================================

/**
 * 연결된 강사 조회 (학생용)
 * 현재 학생이 연결된 강사 정보를 반환합니다.
 */
export async function getMyTeacher(): Promise<{
  data: ConnectedTeacher | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new AppError('AUTH_REQUIRED') };
  }

  // teacher_student 테이블에서 연결 정보 조회
  const { data: connection, error: connectionError } = await supabase
    .from('teacher_student')
    .select(`
      created_at,
      teacher:users!teacher_student_teacher_id_fkey (
        id,
        name,
        email
      )
    `)
    .eq('student_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (connectionError) {
    if (connectionError.code === 'PGRST116') {
      // No rows returned - not connected
      return { data: null, error: null };
    }
    return { data: null, error: classifyError(connectionError, { resource: 'connection' }) };
  }

  if (!connection || !connection.teacher) {
    return { data: null, error: null };
  }

  const teacher = connection.teacher as unknown as User;

  return {
    data: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      connected_at: connection.created_at || new Date().toISOString(),
    },
    error: null,
  };
}

/**
 * 강사 연결 여부 확인 (학생용)
 */
export async function isConnectedToTeacher(): Promise<boolean> {
  const { data } = await getMyTeacher();
  return data !== null;
}
