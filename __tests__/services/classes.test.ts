/**
 * 반 관리 서비스 테스트 (실행 검증)
 *
 * 커버리지 0% 였던 파일이다.
 *
 * 이 서비스는 대부분 RPC 를 감싸는 얇은 층이라 확인할 것은 세 가지다.
 *   1. RPC 이름과 파라미터
 *   2. RPC 가 { success: false, error } 를 200 으로 돌려주는 경우 — 그 코드가
 *      한국어 문구로 바뀌어야 화면에 원인이 보인다
 *   3. moveClassMember 의 롤백 — 여기만 여러 호출을 조합한다
 */

import { mockSupabase } from '../mocks/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
}));

(global as any).__DEV__ = true;
jest.spyOn(console, 'warn').mockImplementation(() => {});

import {
  getTeacherClasses,
  getClassDetail,
  createClass,
  updateClass,
  deleteClass,
  addClassMember,
  removeClassMember,
  moveClassMember,
} from '@/services/classes';

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// 조회
// ============================================================================

describe('getTeacherClasses', () => {
  it('반 목록을 돌려준다', async () => {
    const classes = [{ id: 'c1', name: 'A반', member_count: 5 }];
    mockSupabase.rpc.mockResolvedValueOnce({ data: classes, error: null });

    const { data, error } = await getTeacherClasses();

    expect(error).toBeNull();
    expect(data).toEqual(classes);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_teacher_classes');
  });

  it('결과가 없으면 빈 배열이다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

    const { data } = await getTeacherClasses();

    expect(data).toEqual([]);
  });

  it('조회 실패를 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });

    const { data, error } = await getTeacherClasses();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe('getClassDetail', () => {
  it('반 id 를 넘긴다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, class: { id: 'c1', name: 'A반' }, members: [] },
      error: null,
    });

    const { data } = await getClassDetail('c1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_class_detail', { p_class_id: 'c1' });
    expect(data?.success).toBe(true);
  });

  it('RPC 에러 코드를 한국어 문구로 바꿔 돌려준다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'PERM_UNAUTHORIZED' },
      error: null,
    });

    const { data } = await getClassDetail('someone-elses-class');

    expect(data?.success).toBe(false);
    // 코드가 그대로 화면에 나가면 안 된다
    expect(data?.error).not.toBe('PERM_UNAUTHORIZED');
    expect(data?.error).toBeTruthy();
  });
});

// ============================================================================
// 생성 · 수정 · 삭제
// ============================================================================

describe('createClass', () => {
  it('이름과 설명을 넘긴다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true, class_id: 'c1' }, error: null });

    const result = await createClass('A반', '초급반');

    expect(result.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_class', {
      p_name: 'A반',
      p_description: '초급반',
    });
  });

  it('설명을 생략하면 null 로 보낸다 (빈 문자열이 아니다)', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await createClass('A반');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_class', {
      p_name: 'A반',
      p_description: null,
    });
  });

  it('Supabase 에러를 실패로 돌려준다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const result = await createClass('A반');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('RPC 비즈니스 에러를 한국어로 바꾼다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'VAL_FAILED' },
      error: null,
    });

    const result = await createClass('');

    expect(result.success).toBe(false);
    expect(result.error).not.toBe('VAL_FAILED');
  });
});

describe('updateClass', () => {
  it('바꾸지 않는 항목은 null 로 보낸다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await updateClass('c1', '새 이름');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_class', {
      p_class_id: 'c1',
      p_name: '새 이름',
      p_description: null,
    });
  });

  it('설명을 빈 문자열로 지울 수 있다 (?? 는 빈 문자열을 통과시킨다)', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await updateClass('c1', undefined, '');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_class', {
      p_class_id: 'c1',
      p_name: null,
      p_description: '',
    });
  });
});

describe('deleteClass', () => {
  it('하드 삭제가 아니라 soft_delete_class 를 부른다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    const result = await deleteClass('c1');

    expect(result.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('soft_delete_class', { p_class_id: 'c1' });
  });

  it('권한이 없으면 실패를 돌려준다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'PERM_UNAUTHORIZED' },
      error: null,
    });

    const result = await deleteClass('c1');

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// 반원 관리
// ============================================================================

describe('addClassMember / removeClassMember', () => {
  it('추가는 반과 학생을 함께 넘긴다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await addClassMember('c1', 's1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('add_class_member', {
      p_class_id: 'c1',
      p_student_id: 's1',
    });
  });

  it('제외도 같은 파라미터를 쓴다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    await removeClassMember('c1', 's1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('remove_class_member', {
      p_class_id: 'c1',
      p_student_id: 's1',
    });
  });
});

// ============================================================================
// 반 이동 — 유일하게 여러 호출을 조합하는 곳
//
// 학생을 A반에서 B반으로 옮기는데 중간에 실패하면 양쪽에 다 있거나
// 양쪽에 다 없는 상태가 된다. 순서와 롤백이 그래서 중요하다.
// ============================================================================

describe('moveClassMember', () => {
  it('추가를 먼저 하고 제거를 나중에 한다 — 실패해도 원래 반은 유지된다', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: { success: true }, error: null })  // add to B
      .mockResolvedValueOnce({ data: { success: true }, error: null }); // remove from A

    const result = await moveClassMember('classA', 'classB', 's1');

    expect(result.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(1, 'add_class_member', {
      p_class_id: 'classB',
      p_student_id: 's1',
    });
    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(2, 'remove_class_member', {
      p_class_id: 'classA',
      p_student_id: 's1',
    });
  });

  it('대상 반 추가가 실패하면 원래 반을 건드리지 않는다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'PERM_UNAUTHORIZED' },
      error: null,
    });

    const result = await moveClassMember('classA', 'classB', 's1');

    expect(result.success).toBe(false);
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1); // remove 는 부르지 않았다
  });

  it('원래 반 제거가 실패하면 대상 반에서 다시 빼 롤백한다 — 양쪽에 남지 않는다', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: { success: true }, error: null })                      // add to B
      .mockResolvedValueOnce({ data: { success: false, error: 'NF_CLASS' }, error: null })  // remove from A 실패
      .mockResolvedValueOnce({ data: { success: true }, error: null });                     // 롤백: remove from B

    const result = await moveClassMember('classA', 'classB', 's1');

    expect(result.success).toBe(false);
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    expect(mockSupabase.rpc).toHaveBeenNthCalledWith(3, 'remove_class_member', {
      p_class_id: 'classB',
      p_student_id: 's1',
    });
  });
});
