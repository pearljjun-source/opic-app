/**
 * 토픽 서비스 테스트 (실행 검증)
 *
 * 커버리지 0% 였던 파일이다. 이번 세션에서 실제 장애가 난 영역이기도 하다 —
 * 토픽 배정이 풀리면서 학생 스크립트가 화면에서 사라졌다.
 *
 * 이 서비스의 함수는 대부분 RPC 를 감싸는 얇은 층이라, 확인할 가치가 있는 것은
 * 세 가지다.
 *   1. RPC 이름과 파라미터 (오타 하나로 조용히 실패한다)
 *   2. RPC 가 { success: false, error } 를 담아 200 으로 돌려주는 경우
 *      — Supabase 에러가 아니므로 error 만 보면 성공으로 착각한다
 *   3. 로그인이 없을 때 서버를 부르지 않는지
 */

import { mockSupabase } from '../mocks/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
}));

(global as any).__DEV__ = true;
jest.spyOn(console, 'warn').mockImplementation(() => {});

import {
  getTopicGroups,
  getSurveyProfile,
  saveSurveyProfile,
  setStudentTopics,
  getStudentTopicScriptCounts,
  getStudentTopicsWithProgress,
  getMyTopicsWithProgress,
  getTopicQuestionsWithScripts,
  getMyTopicQuestionsWithScripts,
} from '@/services/topics';
import { ERROR_CODES } from '@/lib/errors';

const mockChain = mockSupabase._mockChain;
const mockUser = { id: 'student-1', email: 'student@test.com' };

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
});

// ============================================================================
// 토픽 그룹 (Q4~Q7)
// ============================================================================

describe('getTopicGroups', () => {
  it('활성 그룹만 정렬 순서대로 조회한다', async () => {
    const groups = [{ id: 'g1', name_ko: '여가 활동', selection_type: 'multiple', min_selections: 2 }];
    mockChain.order.mockResolvedValueOnce({ data: groups, error: null });

    const { data, error } = await getTopicGroups();

    expect(error).toBeNull();
    expect(data).toEqual(groups);
    expect(mockSupabase.from).toHaveBeenCalledWith('topic_groups');
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
    expect(mockChain.order).toHaveBeenCalledWith('sort_order', { ascending: true });
  });

  it('조회 실패를 전달한다', async () => {
    mockChain.order.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const { data, error } = await getTopicGroups();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('결과가 없으면 빈 배열이다 (null 이 화면으로 새지 않는다)', async () => {
    mockChain.order.mockResolvedValueOnce({ data: null, error: null });

    const { data } = await getTopicGroups();

    expect(data).toEqual([]);
  });
});

// ============================================================================
// 서베이 프로필 (Q1~Q3)
// ============================================================================

describe('getSurveyProfile', () => {
  it('학생 id 를 넘겨 조회한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, profile: { job_type: 'office_worker', is_student: false } },
      error: null,
    });

    const { data, error } = await getSurveyProfile('student-1');

    expect(error).toBeNull();
    expect(data).toMatchObject({ job_type: 'office_worker' });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_survey_profile', {
      p_student_id: 'student-1',
    });
  });

  it('프로필을 아직 저장하지 않았으면 null 이다 (에러가 아니다)', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, profile: null },
      error: null,
    });

    const { data, error } = await getSurveyProfile('student-1');

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('RPC 가 success:false 를 담아 오면 에러로 취급한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'NOT_CONNECTED' },
      error: null,
    });

    const { data, error } = await getSurveyProfile('other-student');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe('saveSurveyProfile', () => {
  const profile = {
    job_type: 'office_worker',
    is_student: false,
    student_type: null,
    residence_type: 'family_house',
  } as any;

  it('프로필 항목을 개별 파라미터로 펼쳐 보낸다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    const { error } = await saveSurveyProfile('student-1', profile);

    expect(error).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('save_survey_profile', {
      p_student_id: 'student-1',
      p_job_type: 'office_worker',
      p_is_student: false,
      p_student_type: null,
      p_residence_type: 'family_house',
    });
  });

  it('RPC 비즈니스 에러를 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'NOT_CONNECTED' },
      error: null,
    });

    const { error } = await saveSurveyProfile('student-1', profile);

    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 토픽 배정
//
// 서버가 선택 규칙(그룹별 최소 개수, 총 12개 이상)을 검증하고 detail 문구를
// 돌려준다. 그 문구가 화면까지 그대로 가야 학생이 무엇을 고쳐야 할지 안다.
// ============================================================================

describe('setStudentTopics', () => {
  it('학생 id 와 토픽 배열을 넘긴다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    const { error } = await setStudentTopics('student-1', ['t1', 't2']);

    expect(error).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('set_student_topics', {
      p_student_id: 'student-1',
      p_topic_ids: ['t1', 't2'],
    });
  });

  it('서버가 준 detail 문구를 그대로 보여준다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'GROUP_MIN_NOT_MET',
        detail: '여가 활동에서 최소 2개를 선택해야 합니다.',
      },
      error: null,
    });

    const { error } = await setStudentTopics('student-1', ['t1']);

    expect(error?.message).toBe('여가 활동에서 최소 2개를 선택해야 합니다.');
  });

  it('detail 이 없으면 에러 코드로 문구를 만든다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: false, error: 'INVALID_TOPIC' },
      error: null,
    });

    const { error } = await setStudentTopics('student-1', ['bad-id']);

    expect(error).not.toBeNull();
    expect(error?.message).toBeTruthy();
  });

  it('Supabase 에러도 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection lost' },
    });

    const { error } = await setStudentTopics('student-1', ['t1']);

    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 토픽별 스크립트 수 (배정 해제 경고용)
// ============================================================================

describe('getStudentTopicScriptCounts', () => {
  it('행 배열을 { topicId: 개수 } 로 바꾼다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [
        { topic_id: 't1', scripts_count: 3 },
        { topic_id: 't2', scripts_count: 1 },
      ],
      error: null,
    });

    const { data } = await getStudentTopicScriptCounts('student-1');

    expect(data).toEqual({ t1: 3, t2: 1 });
  });

  it('개수가 문자열로 와도 숫자로 만든다 (bigint 는 문자열로 온다)', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ topic_id: 't1', scripts_count: '5' }],
      error: null,
    });

    const { data } = await getStudentTopicScriptCounts('student-1');

    expect(data.t1).toBe(5);
  });

  it('RPC 가 없으면(미배포) 빈 객체를 돌려줘 저장을 막지 않는다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'function does not exist', code: '42883' },
    });

    const { data, error } = await getStudentTopicScriptCounts('student-1');

    expect(data).toEqual({});
    expect(error).not.toBeNull(); // 에러는 알리되 경고만 생략된다
  });

  it('결과가 없으면 빈 객체다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    const { data } = await getStudentTopicScriptCounts('student-1');

    expect(data).toEqual({});
  });
});

// ============================================================================
// 토픽별 진도
// ============================================================================

describe('getStudentTopicsWithProgress (강사)', () => {
  it('조회 대상 학생 id 를 넘긴다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    await getStudentTopicsWithProgress('student-9');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_student_topics_with_progress', {
      p_student_id: 'student-9',
    });
  });

  it('배정 토픽과 보관 토픽을 그대로 전달한다', async () => {
    const rows = [
      { topic_id: 't1', topic_name_ko: '여행', is_assigned: true, scripts_count: 2 },
      { topic_id: 't2', topic_name_ko: '자기소개', is_assigned: false, scripts_count: 1 },
    ];
    mockSupabase.rpc.mockResolvedValueOnce({ data: rows, error: null });

    const { data } = await getStudentTopicsWithProgress('student-9');

    expect(data).toHaveLength(2);
    expect(data?.[1].is_assigned).toBe(false);
  });

  it('조회 실패를 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });

    const { data, error } = await getStudentTopicsWithProgress('student-9');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe('getMyTopicsWithProgress (학생 본인)', () => {
  it('로그인한 사용자 id 로 조회한다 — 클라이언트가 id 를 정하지 않는다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    await getMyTopicsWithProgress();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_student_topics_with_progress', {
      p_student_id: mockUser.id,
    });
  });

  it('로그인이 없으면 서버를 부르지 않는다', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { data, error } = await getMyTopicsWithProgress();

    expect(data).toBeNull();
    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('결과가 없으면 빈 배열이다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

    const { data } = await getMyTopicsWithProgress();

    expect(data).toEqual([]);
  });
});

// ============================================================================
// 토픽별 질문 + 스크립트
// ============================================================================

describe('getTopicQuestionsWithScripts (강사)', () => {
  it('학생과 토픽을 함께 넘긴다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    await getTopicQuestionsWithScripts('student-9', 'topic-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_topic_questions_with_scripts', {
      p_student_id: 'student-9',
      p_topic_id: 'topic-1',
    });
  });

  it('스크립트가 없는 질문도 그대로 돌려준다 (화면이 준비 중으로 표시한다)', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [
        { question_id: 'q1', question_text: 'Describe your home', script_id: 's1' },
        { question_id: 'q2', question_text: 'Tell me about...', script_id: null },
      ],
      error: null,
    });

    const { data } = await getTopicQuestionsWithScripts('student-9', 'topic-1');

    expect(data).toHaveLength(2);
    expect(data?.[1].script_id).toBeNull();
  });
});

describe('getMyTopicQuestionsWithScripts (학생 본인)', () => {
  it('로그인한 사용자 id 로 조회한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    await getMyTopicQuestionsWithScripts('topic-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_topic_questions_with_scripts', {
      p_student_id: mockUser.id,
      p_topic_id: 'topic-1',
    });
  });

  it('로그인이 없으면 서버를 부르지 않는다', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { error } = await getMyTopicQuestionsWithScripts('topic-1');

    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('조회 실패를 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });

    const { data, error } = await getMyTopicQuestionsWithScripts('topic-1');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
