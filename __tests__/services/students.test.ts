/**
 * 학생 관리 서비스 테스트 (실행 검증)
 *
 * 커버리지 0% 였던 파일이다. 강사가 학생을 보는 모든 화면이 여기를 거친다.
 *
 * 특히 확인할 것:
 *   · disconnectStudent — 연결을 찾고 지우는 두 단계다. 남의 연결을 끊을 수 없어야 한다
 *   · updateStudentNotes — undefined/null/값 세 가지를 구분하는 규약이 있다.
 *     이게 틀어지면 메모를 안 건드리려다 지워버리거나, 지우려다 안 지워진다
 */

import { mockSupabase } from '../mocks/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
}));

(global as any).__DEV__ = true;
jest.spyOn(console, 'warn').mockImplementation(() => {});

import {
  getConnectedStudents,
  disconnectStudent,
  getStudentDetail,
  getStudentScripts,
  getStudentPractices,
  updateStudentNotes,
} from '@/services/students';
import { ERROR_CODES } from '@/lib/errors';

const mockChain = mockSupabase._mockChain;
const mockTeacher = { id: 'teacher-1', email: 'teacher@test.com' };

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockTeacher }, error: null });
});

// ============================================================================
// 목록 조회
// ============================================================================

describe('getConnectedStudents', () => {
  it('강사의 학생 목록을 돌려준다', async () => {
    const students = [{ id: 's1', name: '김학생', scripts_count: 3 }];
    mockSupabase.rpc.mockResolvedValueOnce({ data: students, error: null });

    const { data, error } = await getConnectedStudents();

    expect(error).toBeNull();
    expect(data).toEqual(students);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_teacher_students');
  });

  it('결과가 없으면 빈 배열이다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

    expect((await getConnectedStudents()).data).toEqual([]);
  });

  it('조회 실패를 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });

    const { data, error } = await getConnectedStudents();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 연결 해제
// ============================================================================

describe('disconnectStudent', () => {
  it('내 연결만 찾아서 끊는다', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: 'conn-1' }, error: null });
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    const { error } = await disconnectStudent('student-1');

    expect(error).toBeNull();
    // 조회 조건에 본인 teacher_id 가 걸려 있어야 남의 연결을 못 끊는다
    expect(mockChain.eq).toHaveBeenCalledWith('teacher_id', mockTeacher.id);
    expect(mockChain.eq).toHaveBeenCalledWith('student_id', 'student-1');
    expect(mockChain.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('하드 삭제가 아니라 soft_delete_connection 을 부른다', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: 'conn-1' }, error: null });
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await disconnectStudent('student-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('soft_delete_connection', {
      p_connection_id: 'conn-1',
    });
  });

  it('연결이 없으면 RPC 를 부르지 않는다', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: null });

    const { error } = await disconnectStudent('not-my-student');

    expect((error as any)?.code).toBe(ERROR_CODES.NF_CONNECTION);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('로그인이 없으면 아무것도 조회하지 않는다', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { error } = await disconnectStudent('student-1');

    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('RPC 가 success:false 를 담아 오면 실패로 취급한다', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: 'conn-1' }, error: null });
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'PERM_UNAUTHORIZED' },
      error: null,
    });

    const { error } = await disconnectStudent('student-1');

    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 상세 조회
// ============================================================================

describe('getStudentDetail / getStudentScripts / getStudentPractices', () => {
  it('상세는 학생 id 를 넘긴다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, student: { id: 's1', name: '김학생' } },
      error: null,
    });

    await getStudentDetail('s1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_student_detail', { p_student_id: 's1' });
  });

  it('스크립트 목록은 get_student_scripts 를 부른다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    await getStudentScripts('s1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_student_scripts', { p_student_id: 's1' });
  });

  it('연습 목록은 get_student_practices 를 부른다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    await getStudentPractices('s1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_student_practices', { p_student_id: 's1' });
  });

  it('조회 실패는 빈 배열이 아니라 에러로 돌려준다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });

    const { data, error } = await getStudentScripts('s1');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 메모 / 목표 등급
//
// undefined = 건드리지 않음, null = 비우기, 값 = 설정.
// 이 규약이 틀어지면 목표 등급만 바꾸려다 메모가 지워진다.
// ============================================================================

describe('updateStudentNotes — 부분 수정 규약', () => {
  beforeEach(() => {
    mockSupabase.rpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('메모만 넘기면 목표 등급 파라미터를 아예 보내지 않는다', async () => {
    await updateStudentNotes({ studentId: 's1', notes: '발음 연습 필요' });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_student_notes', {
      p_student_id: 's1',
      p_notes: '발음 연습 필요',
    });
  });

  it('목표 등급만 넘기면 메모 파라미터를 보내지 않는다', async () => {
    await updateStudentNotes({ studentId: 's1', targetGrade: 'IH' as any });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_student_notes', {
      p_student_id: 's1',
      p_target_grade: 'IH',
    });
  });

  it('null 은 빈 문자열로 보낸다 — 비우겠다는 뜻이다', async () => {
    await updateStudentNotes({ studentId: 's1', notes: null, targetGrade: null });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_student_notes', {
      p_student_id: 's1',
      p_notes: '',
      p_target_grade: '',
    });
  });

  it('둘 다 넘기면 둘 다 보낸다', async () => {
    await updateStudentNotes({ studentId: 's1', notes: '메모', targetGrade: 'AL' as any });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_student_notes', {
      p_student_id: 's1',
      p_notes: '메모',
      p_target_grade: 'AL',
    });
  });

  it('아무것도 안 넘기면 학생 id 만 보낸다 (변경 없음)', async () => {
    await updateStudentNotes({ studentId: 's1' });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_student_notes', {
      p_student_id: 's1',
    });
  });
});

describe('updateStudentNotes — 실패', () => {
  it('서버 검증 실패를 전달한다 (등급 화이트리스트, 2000자 제한)', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'VAL_FAILED' },
      error: null,
    });

    const { error } = await updateStudentNotes({ studentId: 's1', targetGrade: 'XX' as any });

    expect(error).not.toBeNull();
  });

  it('Supabase 에러를 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const { error } = await updateStudentNotes({ studentId: 's1', notes: 'x' });

    expect(error).not.toBeNull();
  });
});
