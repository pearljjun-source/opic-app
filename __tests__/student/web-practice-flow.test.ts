/**
 * 학생 연습 플로우 테스트 (실행 검증)
 *
 * ⚠️ 이 파일은 원래 화면 소스를 readFileSync로 읽어 "expo-audio를 import한다",
 *    "정지 버튼 텍스트가 '정지'다" 같은 문자열을 대조했다. 그건 구현 세부사항이라
 *    리팩터링하면 깨지고, 실제 업로드·STT·피드백이 망가져도 통과한다.
 *    지금은 services/practices.ts 를 실제로 호출해 확인한다.
 *
 * 검증 대상 (녹음 → 업로드 → STT → 피드백 → 저장):
 * 1. uploadRecording — 경로 소유권(user.id/), 웹/네이티브 분기, 확장자 결정
 * 2. createPractice — student_id를 서버 세션에서 정한다 (클라이언트 입력 아님)
 * 3. transcribeAudio / generateFeedback — Edge Function 인자와 에러 분류
 * 4. updatePracticeWithFeedback — 본인 기록만 수정
 * 5. getDailyProgress / setDailyGoal — RPC 에러 경로
 *
 * 화면(practice.tsx, shadowing.tsx)의 재생·정지 토글 동작은 컴포넌트 테스트 영역이다.
 * CLAUDE.md "테스트 로드맵" 3단계에서 다룬다.
 */

import { Platform } from 'react-native';

import { mockSupabase } from '../mocks/supabase';

const mockInvokeFunction = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
  invokeFunction: (...args: any[]) => mockInvokeFunction(...args),
}));

(global as any).__DEV__ = true;
jest.spyOn(console, 'warn').mockImplementation(() => {});

import {
  uploadRecording,
  createPractice,
  updatePracticeWithFeedback,
  transcribeAudio,
  generateFeedback,
  getDailyProgress,
  setDailyGoal,
} from '@/services/practices';
import { ERROR_CODES } from '@/lib/errors';

// ============================================================================
// 환경
// ============================================================================

const originalOS = Platform.OS;
const mockUser = { id: 'student-1', email: 'student@test.com' };

function mockPlatformOS(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

/** storage.from()이 매 호출마다 새 객체를 주므로, 인자 확인이 가능하도록 고정한다 */
let uploadMock: jest.Mock;
function stubStorage(uploadResult: { error: unknown } = { error: null }) {
  uploadMock = jest.fn().mockResolvedValue(uploadResult);
  mockSupabase.storage.from.mockReturnValue({
    upload: uploadMock,
    createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }),
  } as any);
}

/** 웹 업로드 경로에서 쓰는 fetch(blobUri) → Blob 흉내 */
function stubFetchBlob(type: string) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    blob: async () => ({ type, size: 1024 }),
  });
}

const mockChain = mockSupabase._mockChain;

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformOS('web');
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
  stubStorage();
  stubFetchBlob('audio/webm');
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true });
});

// ============================================================================
// 1. uploadRecording — 저장 경로가 곧 권한이다
//
//    whisper-stt Edge Function은 audioPath가 `${user.id}/` 로 시작하는지로
//    소유권을 검증한다(CLAUDE.md 보안 원칙). 여기서 경로가 틀리면 STT가 거부된다.
// ============================================================================

describe('uploadRecording — 경로 소유권', () => {
  it('경로가 항상 로그인한 사용자 id로 시작한다', async () => {
    const { data, error } = await uploadRecording('blob:http://x/abc', 'practice-123');

    expect(error).toBeNull();
    expect(data!.path.startsWith(`${mockUser.id}/`)).toBe(true);
  });

  it('업로드에 넘기는 경로와 반환하는 경로가 같다', async () => {
    const { data } = await uploadRecording('blob:http://x/abc', 'practice-123');

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock.mock.calls[0][0]).toBe(data!.path);
  });

  it('practice-recordings 버킷에 올린다', async () => {
    await uploadRecording('blob:http://x/abc', 'practice-123');

    expect(mockSupabase.storage.from).toHaveBeenCalledWith('practice-recordings');
  });

  it('덮어쓰기를 허용하지 않는다 (upsert: false)', async () => {
    await uploadRecording('blob:http://x/abc', 'practice-123');

    expect(uploadMock.mock.calls[0][2]).toMatchObject({ upsert: false });
  });

  it('로그인이 없으면 업로드를 시도하지 않는다', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { data, error } = await uploadRecording('blob:http://x/abc', 'practice-123');

    expect(data).toBeNull();
    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe('uploadRecording — 웹: 확장자를 blob.type에서 정한다', () => {
  it('audio/webm → .webm', async () => {
    stubFetchBlob('audio/webm');
    const { data } = await uploadRecording('blob:http://x/abc', 'p1');
    expect(data!.path).toBe('student-1/p1.webm');
  });

  it('Safari의 audio/mp4 → .m4a', async () => {
    stubFetchBlob('audio/mp4');
    const { data } = await uploadRecording('blob:http://x/abc', 'p1');
    expect(data!.path).toBe('student-1/p1.m4a');
  });

  it('알 수 없는 타입은 webm으로 떨어진다', async () => {
    stubFetchBlob('application/octet-stream');
    const { data } = await uploadRecording('blob:http://x/abc', 'p1');
    expect(data!.path).toBe('student-1/p1.webm');
  });

  it('빈 mimeType이면 contentType에 기본값을 채워 보낸다', async () => {
    stubFetchBlob('');
    await uploadRecording('blob:http://x/abc', 'p1');
    expect(uploadMock.mock.calls[0][2]).toMatchObject({ contentType: 'audio/webm' });
  });

  it('blob 객체를 그대로 올린다 — RN의 {uri,name,type} 객체가 아니다', async () => {
    stubFetchBlob('audio/webm');
    await uploadRecording('blob:http://x/abc', 'p1');

    const body = uploadMock.mock.calls[0][1] as any;
    expect(body.type).toBe('audio/webm');
    expect(body.uri).toBeUndefined(); // {uri,...} 를 보내면 웹에서 [object Object]가 된다
  });
});

describe('uploadRecording — 네이티브', () => {
  beforeEach(() => mockPlatformOS('ios'));

  it('항상 .m4a로 저장한다 (expo-audio 녹음 설정 고정)', async () => {
    const { data } = await uploadRecording('file:///tmp/rec.m4a', 'p1');
    expect(data!.path).toBe('student-1/p1.m4a');
  });

  it('FormData로 multipart 업로드한다', async () => {
    await uploadRecording('file:///tmp/rec.m4a', 'p1');

    expect(uploadMock.mock.calls[0][1]).toBeInstanceOf(FormData);
    expect(uploadMock.mock.calls[0][2]).toMatchObject({ contentType: 'multipart/form-data' });
  });

  it('blob fetch를 하지 않는다', async () => {
    await uploadRecording('file:///tmp/rec.m4a', 'p1');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('uploadRecording — 실패', () => {
  it('스토리지 에러를 삼키지 않는다', async () => {
    stubStorage({ error: new Error('storage full') });

    const { data, error } = await uploadRecording('blob:http://x/abc', 'p1');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('blob fetch가 던져도 예외를 밖으로 내보내지 않는다', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('blob 만료'));

    const { data, error } = await uploadRecording('blob:http://x/abc', 'p1');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 2. createPractice — 학생 id는 서버 세션이 정한다
// ============================================================================

describe('createPractice', () => {
  it('student_id를 클라이언트가 아니라 로그인 세션에서 채운다', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: 'practice-1' }, error: null });

    await createPractice({ scriptId: 'script-1', audioPath: 'student-1/p1.webm', duration: 42 });

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: mockUser.id }),
    );
  });

  it('업로드된 파일 경로를 audio_url에 저장한다 (서명 URL이 아니다)', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: 'practice-1' }, error: null });

    await createPractice({ scriptId: 'script-1', audioPath: 'student-1/p1.webm', duration: 42 });

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ audio_url: 'student-1/p1.webm', duration: 42 }),
    );
  });

  it('로그인이 없으면 INSERT하지 않는다', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { error } = await createPractice({ scriptId: 's', audioPath: 'p', duration: 1 });

    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockChain.insert).not.toHaveBeenCalled();
  });

  it('INSERT 실패를 전달한다', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

    const { data, error } = await createPractice({ scriptId: 's', audioPath: 'p', duration: 1 });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 3. STT · AI 피드백 — 비용이 드는 외부 API 경로
// ============================================================================

describe('transcribeAudio', () => {
  it('whisper-stt에 audioPath만 넘긴다 (텍스트 주입 여지 없음)', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: { transcription: 'hello' }, error: null });

    const { data } = await transcribeAudio('student-1/p1.webm');

    expect(mockInvokeFunction).toHaveBeenCalledWith('whisper-stt', { audioPath: 'student-1/p1.webm' });
    expect(data!.transcription).toBe('hello');
  });

  it('응답에 transcription이 없으면 빈 문자열로 방어한다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: {}, error: null });

    const { data, error } = await transcribeAudio('student-1/p1.webm');

    expect(error).toBeNull();
    expect(data!.transcription).toBe('');
  });

  it('rate limit(429)을 whisper 에러로 분류한다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: null,
      error: Object.assign(new Error('Rate limit exceeded'), { status: 429 }),
    });

    const { data, error } = await transcribeAudio('student-1/p1.webm');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('Edge Function이 던져도 예외를 밖으로 내보내지 않는다', async () => {
    mockInvokeFunction.mockRejectedValueOnce(new Error('network down'));

    const { data, error } = await transcribeAudio('student-1/p1.webm');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe('generateFeedback', () => {
  it('스크립트·전사·질문유형을 claude-feedback에 넘긴다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: { score: 88, reproductionRate: 91, feedback: { summary: 'good' } },
      error: null,
    });

    const { data } = await generateFeedback('My home is cozy.', 'My home is cozy', 'describe');

    expect(mockInvokeFunction).toHaveBeenCalledWith('claude-feedback', {
      scriptContent: 'My home is cozy.',
      transcription: 'My home is cozy',
      questionType: 'describe',
    });
    expect(data).toMatchObject({ score: 88, reproductionRate: 91 });
  });

  it('questionType이 null이면 undefined로 보낸다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: { score: 0, reproductionRate: 0, feedback: {} },
      error: null,
    });

    await generateFeedback('a', 'b', null);

    expect(mockInvokeFunction.mock.calls[0][1]).toMatchObject({ questionType: undefined });
  });

  it('점수가 없으면 0으로 방어한다 (NaN이 화면에 나가지 않도록)', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: { feedback: {} }, error: null });

    const { data } = await generateFeedback('a', 'b');

    expect(data!.score).toBe(0);
    expect(data!.reproductionRate).toBe(0);
  });

  it('Edge Function 에러를 전달한다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: null, error: new Error('claude down') });

    const { data, error } = await generateFeedback('a', 'b');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

// ============================================================================
// 4. updatePracticeWithFeedback — 본인 기록만
// ============================================================================

describe('updatePracticeWithFeedback', () => {
  it('practiceId와 student_id를 함께 걸어 남의 기록을 못 고치게 한다', async () => {
    mockChain.eq.mockReturnThis();
    mockChain.eq.mockReturnValueOnce(mockChain).mockResolvedValueOnce({ error: null });

    await updatePracticeWithFeedback({
      practiceId: 'practice-1',
      transcription: 'hi',
      score: 90,
      reproductionRate: 95,
      feedback: {} as any,
    });

    expect(mockChain.eq).toHaveBeenCalledWith('id', 'practice-1');
    expect(mockChain.eq).toHaveBeenCalledWith('student_id', mockUser.id);
  });

  it('로그인이 없으면 UPDATE하지 않는다', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { error } = await updatePracticeWithFeedback({
      practiceId: 'p',
      transcription: '',
      score: 0,
      reproductionRate: 0,
      feedback: {} as any,
    });

    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockChain.update).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 5. 일일 목표 (076 마이그레이션 RPC)
//
//    ⚠️ 이 RPC들은 2026-08-28 확인 시점에 프로덕션 DB에 없었다.
//    RPC가 없을 때 화면이 죽지 않고 에러를 돌려주는지가 여기서 검증된다.
// ============================================================================

describe('getDailyProgress', () => {
  it('get_daily_progress RPC를 호출한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { completed: 2, target: 3 }, error: null });

    const { data, error } = await getDailyProgress();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_daily_progress');
    expect(error).toBeNull();
    expect(data).toMatchObject({ completed: 2, target: 3 });
  });

  it('RPC가 없으면(미배포) 에러를 돌려준다 — 던지지 않는다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'function public.get_daily_progress() does not exist', code: '42883' },
    });

    const { data, error } = await getDailyProgress();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('RPC가 { error } 를 담아 성공 응답해도 에러로 취급한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { error: 'NOT_AUTHENTICATED' }, error: null });

    const { data, error } = await getDailyProgress();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('로그인이 없으면 RPC를 부르지 않는다', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { error } = await getDailyProgress();

    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

describe('setDailyGoal', () => {
  it('목표치를 p_daily_target으로 넘긴다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: {}, error: null });

    const { error } = await setDailyGoal(5);

    expect(error).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('set_daily_goal', { p_daily_target: 5 });
  });

  it('RPC 에러를 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const { error } = await setDailyGoal(5);

    expect(error).not.toBeNull();
  });

  it('로그인이 없으면 부르지 않는다', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { error } = await setDailyGoal(3);

    expect((error as any)?.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 6. 플로우 — 업로드 경로가 STT로 그대로 이어진다
// ============================================================================

describe('시나리오: 녹음 → 업로드 → 연습 생성 → STT → 피드백 저장', () => {
  it('업로드가 만든 경로가 createPractice와 transcribeAudio에 같은 값으로 전달된다', async () => {
    stubFetchBlob('audio/webm');

    // ① 업로드
    const { data: uploaded } = await uploadRecording('blob:http://x/abc', 'practice-abc');
    expect(uploaded!.path).toBe('student-1/practice-abc.webm');

    // ② 연습 생성
    mockChain.single.mockResolvedValueOnce({ data: { id: 'practice-1' }, error: null });
    await createPractice({ scriptId: 'script-1', audioPath: uploaded!.path, duration: 30 });
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ audio_url: 'student-1/practice-abc.webm' }),
    );

    // ③ STT — Edge Function이 소유권을 검증할 수 있는 경로여야 한다
    mockInvokeFunction.mockResolvedValueOnce({ data: { transcription: 'hi' }, error: null });
    await transcribeAudio(uploaded!.path);
    expect(mockInvokeFunction).toHaveBeenCalledWith('whisper-stt', {
      audioPath: 'student-1/practice-abc.webm',
    });
  });

  it('STT가 실패하면 피드백 단계로 넘어가지 않는다', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ data: null, error: new Error('whisper 429') });

    const { data, error } = await transcribeAudio('student-1/p1.webm');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(mockInvokeFunction).toHaveBeenCalledTimes(1); // claude-feedback은 호출되지 않았다
  });
});
