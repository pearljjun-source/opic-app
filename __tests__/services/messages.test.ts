/**
 * 메시징 서비스 테스트 (실행 검증)
 *
 * ⚠️ 이 파일은 원래 074 마이그레이션 SQL 과 화면 소스를 readFileSync 로 읽어
 *    "CREATE TABLE public.messages 가 적혀 있나" 를 대조했다. 파일 문자열은
 *    DB 에 실제로 적용됐는지 말해주지 않는다 — 076/077 이 DB 에 없는 채로
 *    테스트가 전부 통과했던 것이 그 증거다.
 *
 *    마이그레이션 구조는 이제 `npm run check:schema` 가 실제 DB 와 대조한다.
 *    여기서는 services/messages.ts 를 실제로 호출해 확인한다.
 *
 * 화면 연동(탭 헤더 뱃지, 푸시 네비게이션)은 컴포넌트 테스트 영역이라 뺐다.
 * CLAUDE.md "테스트 로드맵" 3단계에서 다룬다.
 */

import { mockSupabase } from '../mocks/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: require('../mocks/supabase').mockSupabase,
}));

import {
  sendMessage,
  getMyMessages,
  getSentMessages,
  markMessageRead,
  getUnreadMessageCount,
} from '@/services/messages';
import { ERROR_CODES, ERROR_MESSAGES, classifyRpcError } from '@/lib/errors';
import { NOTIFICATION_TYPES, MESSAGE_TARGET_TYPES } from '@/lib/constants';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sendMessage()', () => {
  it('반 메시지 발송 성공 시 messageId와 recipientCount를 반환한다', async () => {
    const mockData = {
      success: true,
      message_id: 'msg-1',
      recipient_count: 5,
    };
    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await sendMessage({
      targetType: 'class',
      targetId: 'class-1',
      title: '공지',
      body: '내일 수업 변경',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('send_message', {
      p_target_type: 'class',
      p_target_id: 'class-1',
      p_title: '공지',
      p_body: '내일 수업 변경',
    });
    expect(result.data).toEqual({ messageId: 'msg-1', recipientCount: 5 });
    expect(result.error).toBeNull();
  });

  it('개별 메시지 발송 성공', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, message_id: 'msg-2', recipient_count: 1 },
      error: null,
    });

    const result = await sendMessage({
      targetType: 'individual',
      targetId: 'student-1',
      body: '피드백 확인해주세요',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('send_message', {
      p_target_type: 'individual',
      p_target_id: 'student-1',
      p_title: null,
      p_body: '피드백 확인해주세요',
    });
    expect(result.data?.recipientCount).toBe(1);
  });

  it('Supabase 에러 시 한국어 에러 메시지를 반환한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Permission denied' },
    });

    const result = await sendMessage({
      targetType: 'class',
      targetId: 'class-1',
      body: 'test',
    });

    expect(result.data).toBeNull();
    expect(typeof result.error).toBe('string');
  });

  it('RPC 비즈니스 에러 (PERM_NOT_TEACHER) 시 에러를 반환한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { error: 'PERM_NOT_TEACHER' },
      error: null,
    });

    const result = await sendMessage({
      targetType: 'class',
      targetId: 'class-1',
      body: 'test',
    });

    expect(result.data).toBeNull();
    expect(typeof result.error).toBe('string');
  });

  it('빈 본문 에러 (MSG_BODY_REQUIRED) 처리', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { error: 'MSG_BODY_REQUIRED' },
      error: null,
    });

    const result = await sendMessage({
      targetType: 'class',
      targetId: 'class-1',
      body: '',
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe('getMyMessages()', () => {
  it('성공 시 메시지 배열을 반환한다', async () => {
    const mockMessages = [
      { id: 'msg-1', title: '공지', body: '내용', sender_name: '김강사', read_at: null, created_at: '2026-04-13', target_type: 'class', class_name: 'A반' },
    ];
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, messages: mockMessages },
      error: null,
    });

    const result = await getMyMessages();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_my_messages', { p_limit: 20, p_offset: 0 });
    expect(result.data).toEqual(mockMessages);
    expect(result.error).toBeNull();
  });

  it('limit과 offset을 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, messages: [] },
      error: null,
    });

    await getMyMessages(10, 5);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_my_messages', { p_limit: 10, p_offset: 5 });
  });

  it('에러 시 한국어 메시지를 반환한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'error' },
    });

    const result = await getMyMessages();

    expect(result.data).toBeNull();
    expect(typeof result.error).toBe('string');
  });
});

describe('getSentMessages()', () => {
  it('성공 시 발송 이력을 반환한다', async () => {
    const mockMessages = [
      { id: 'msg-1', title: '공지', body: '내용', target_name: 'A반', target_type: 'class', recipient_count: 10, read_count: 7, created_at: '2026-04-13' },
    ];
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, messages: mockMessages },
      error: null,
    });

    const result = await getSentMessages();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_sent_messages', { p_limit: 20, p_offset: 0 });
    expect(result.data).toEqual(mockMessages);
  });
});

describe('markMessageRead()', () => {
  it('성공 시 error: null을 반환한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const result = await markMessageRead('msg-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('mark_message_read', { p_message_id: 'msg-1' });
    expect(result.error).toBeNull();
  });

  it('에러 시 에러 메시지를 반환한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'denied' },
    });

    const result = await markMessageRead('msg-1');

    expect(typeof result.error).toBe('string');
  });
});

describe('getUnreadMessageCount()', () => {
  it('성공 시 숫자를 반환한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: 3, error: null });

    const count = await getUnreadMessageCount();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_unread_message_count');
    expect(count).toBe(3);
  });

  it('에러 시 0을 반환한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { code: 'error' } });

    const count = await getUnreadMessageCount();

    expect(count).toBe(0);
  });
});

// ============================================================================
// 페이지네이션 · 예외 경로 (커버되지 않던 구간)
// ============================================================================

describe('페이지네이션', () => {
  it('getMyMessages 기본값은 20건, offset 0', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { messages: [] }, error: null });

    await getMyMessages();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_my_messages', {
      p_limit: 20,
      p_offset: 0,
    });
  });

  it('getMyMessages 는 넘긴 limit/offset 을 그대로 보낸다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { messages: [] }, error: null });

    await getMyMessages(50, 100);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_my_messages', {
      p_limit: 50,
      p_offset: 100,
    });
  });

  it('getSentMessages 도 같은 규칙을 따른다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { messages: [] }, error: null });

    await getSentMessages(5, 10);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_sent_messages', {
      p_limit: 5,
      p_offset: 10,
    });
  });
});

describe('예외를 밖으로 내보내지 않는다', () => {
  it('sendMessage — RPC 가 던져도 에러 문자열로 돌려준다', async () => {
    mockSupabase.rpc.mockRejectedValueOnce(new Error('network down'));

    const { data, error } = await sendMessage({
      targetType: 'class',
      targetId: 'class-1',
      body: 'test',
    });

    expect(data).toBeNull();
    expect(typeof error).toBe('string');
  });

  it('getMyMessages — RPC 가 던져도 화면이 죽지 않는다', async () => {
    mockSupabase.rpc.mockRejectedValueOnce(new Error('boom'));

    const { data, error } = await getMyMessages();

    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it('getSentMessages — RPC 비즈니스 에러를 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { error: 'PERM_NOT_TEACHER' },
      error: null,
    });

    const { data, error } = await getSentMessages();

    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it('markMessageRead — Supabase 에러를 전달한다', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'denied' },
    });

    const { error } = await markMessageRead('msg-1');

    expect(error).toBeTruthy();
  });

  it('getUnreadMessageCount — 던져도 0을 돌려준다 (뱃지가 화면을 깨지 않는다)', async () => {
    mockSupabase.rpc.mockRejectedValueOnce(new Error('boom'));

    expect(await getUnreadMessageCount()).toBe(0);
  });
});

// ============================================================================
// 에러 코드 · 상수 — 소스 문자열이 아니라 실제 값을 확인한다
// ============================================================================

describe('메시징 에러 코드', () => {
  it('RPC 가 돌려주는 문자열이 에러 코드로 매핑된다', () => {
    expect(classifyRpcError('MSG_BODY_REQUIRED', { resource: 'message' }).code)
      .toBe(ERROR_CODES.MSG_BODY_REQUIRED);
    expect(classifyRpcError('MSG_INVALID_TARGET_TYPE', { resource: 'message' }).code)
      .toBe(ERROR_CODES.MSG_INVALID_TARGET_TYPE);
  });

  it('사용자에게 보여줄 한국어 문구가 있다', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.MSG_BODY_REQUIRED]).toBeTruthy();
    expect(ERROR_MESSAGES[ERROR_CODES.MSG_INVALID_TARGET_TYPE]).toBeTruthy();
  });

  it('모르는 코드는 알 수 없는 오류로 떨어진다 (문구가 비지 않는다)', () => {
    const err = classifyRpcError('SOMETHING_NEW', { resource: 'message' });
    expect(err.userMessage).toBeTruthy();
  });
});

describe('메시징 상수', () => {
  it('발송 대상 타입이 RPC 파라미터와 같은 값이다', () => {
    expect(MESSAGE_TARGET_TYPES.CLASS).toBe('class');
    expect(MESSAGE_TARGET_TYPES.INDIVIDUAL).toBe('individual');
  });

  it('새 메시지 알림 타입이 정의되어 있다', () => {
    expect(NOTIFICATION_TYPES.NEW_MESSAGE).toBe('new_message');
  });
});
