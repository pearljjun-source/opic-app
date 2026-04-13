/**
 * 메시징 시스템 테스트
 *
 * 검증 항목:
 * P1: 074 마이그레이션 SQL 구조 (테이블, RPC, RLS, 인덱스)
 * P2: 서비스 레이어 (sendMessage, getMyMessages, getSentMessages, markMessageRead, getUnreadMessageCount)
 * P3: 에러 코드/상수/타입 통합
 * P4: UI 레이아웃 연동 (탭 헤더, 네비게이션, 푸시)
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// P1: 074 마이그레이션 SQL 구조 검증
// ============================================================================

describe('074: messages 테이블', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/074_messaging.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('message_target_type ENUM이 정의된다', () => {
    expect(sql).toContain("CREATE TYPE public.message_target_type AS ENUM ('class', 'individual')");
  });

  it('messages 테이블이 생성된다', () => {
    expect(sql).toContain('CREATE TABLE public.messages');
  });

  it('messages 테이블에 필수 컬럼이 있다', () => {
    expect(sql).toContain('organization_id uuid NOT NULL REFERENCES public.organizations(id)');
    expect(sql).toContain('sender_id     uuid NOT NULL REFERENCES public.users(id)');
    expect(sql).toContain('target_type   message_target_type NOT NULL');
    expect(sql).toContain('target_id     uuid NOT NULL');
    expect(sql).toContain('body          text NOT NULL');
    expect(sql).toContain('deleted_at    timestamptz');
  });

  it('messages 인덱스가 생성된다', () => {
    expect(sql).toContain('idx_messages_org');
    expect(sql).toContain('idx_messages_sender');
  });

  it('message_recipients 테이블이 생성된다', () => {
    expect(sql).toContain('CREATE TABLE public.message_recipients');
  });

  it('message_recipients에 read_at 컬럼이 있다 (읽음 추적)', () => {
    expect(sql).toContain('read_at       timestamptz');
  });

  it('message_recipients에 중복 방지 UNIQUE 인덱스가 있다', () => {
    expect(sql).toContain('idx_message_recipients_unique');
    expect(sql).toContain('(message_id, recipient_id)');
  });

  it('ON DELETE CASCADE로 메시지 삭제 시 수신자도 삭제된다', () => {
    expect(sql).toContain('ON DELETE CASCADE');
  });
});

describe('074: RLS 정책', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/074_messaging.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('messages RLS가 활성화된다', () => {
    expect(sql).toContain('ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY');
  });

  it('message_recipients RLS가 활성화된다', () => {
    expect(sql).toContain('ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY');
  });

  it('발신자만 messages를 조회할 수 있다', () => {
    expect(sql).toContain('messages_select_sender');
    expect(sql).toContain('sender_id = auth.uid()');
  });

  it('수신자만 message_recipients를 조회할 수 있다', () => {
    expect(sql).toContain('message_recipients_select_recipient');
    expect(sql).toContain('recipient_id = auth.uid()');
  });

  it('수신자만 read_at을 업데이트할 수 있다', () => {
    expect(sql).toContain('message_recipients_update_read');
    expect(sql).toContain('FOR UPDATE');
  });
});

describe('074: send_message RPC', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/074_messaging.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('send_message 함수가 SECURITY DEFINER로 정의된다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.send_message');
    expect(sql).toContain('SECURITY DEFINER');
  });

  it('auth.uid()로 인증을 확인한다', () => {
    expect(sql).toContain('v_user_id := auth.uid()');
    expect(sql).toContain("'error', 'NOT_AUTHENTICATED'");
  });

  it('teacher 또는 owner만 발송할 수 있다', () => {
    expect(sql).toContain("v_role NOT IN ('owner', 'teacher')");
    expect(sql).toContain("'error', 'PERM_NOT_TEACHER'");
  });

  it('빈 본문을 거부한다', () => {
    expect(sql).toContain("'error', 'MSG_BODY_REQUIRED'");
  });

  it('class 타입: 반 소유권을 검증한다', () => {
    expect(sql).toContain('FROM public.classes c');
    expect(sql).toContain('c.teacher_id = v_user_id OR v_role = \'owner\'');
  });

  it('class 타입: class_members에서 수신자 팬아웃한다', () => {
    expect(sql).toContain('FROM public.class_members cm');
    expect(sql).toContain('cm.class_id = p_target_id');
  });

  it('individual 타입: 조직 내 학생 여부를 확인한다', () => {
    expect(sql).toContain("om.role = 'student'");
    expect(sql).toContain("'error', 'ORG_STUDENT_NOT_IN_ORG'");
  });

  it('individual 타입: 강사-학생 연결을 확인한다', () => {
    expect(sql).toContain('FROM public.teacher_student ts');
    expect(sql).toContain("'error', 'PERM_NOT_CONNECTED'");
  });

  it('notification_logs에 알림을 생성한다', () => {
    expect(sql).toContain('INSERT INTO public.notification_logs');
    expect(sql).toContain("'new_message'");
  });

  it('응답에 message_id와 recipient_count를 반환한다', () => {
    expect(sql).toContain("'message_id', v_message_id");
    expect(sql).toContain("'recipient_count', v_count");
  });

  it('잘못된 target_type을 거부한다', () => {
    expect(sql).toContain("'error', 'MSG_INVALID_TARGET_TYPE'");
  });
});

describe('074: get_my_messages RPC (학생 수신함)', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/074_messaging.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('get_my_messages 함수가 정의된다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_my_messages');
  });

  it('SECURITY DEFINER + STABLE로 정의된다', () => {
    const funcMatch = sql.match(/get_my_messages[\s\S]*?AS \$\$/);
    expect(funcMatch).not.toBeNull();
    expect(funcMatch![0]).toContain('STABLE');
    expect(funcMatch![0]).toContain('SECURITY DEFINER');
  });

  it('message_recipients와 messages를 JOIN한다', () => {
    expect(sql).toContain('FROM public.message_recipients mr');
    expect(sql).toContain('JOIN public.messages m ON m.id = mr.message_id');
  });

  it('발신자 이름을 포함한다', () => {
    expect(sql).toContain('u.name AS sender_name');
  });

  it('반 이름을 포함한다 (class 타입일 때)', () => {
    expect(sql).toContain('class_name');
  });

  it('read_at을 포함한다', () => {
    expect(sql).toContain('mr.read_at');
  });

  it('p_limit과 p_offset을 지원한다', () => {
    expect(sql).toContain('p_limit  int DEFAULT 20');
    expect(sql).toContain('p_offset int DEFAULT 0');
  });
});

describe('074: get_sent_messages RPC (강사 발송 이력)', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/074_messaging.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('get_sent_messages 함수가 정의된다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_sent_messages');
  });

  it('recipient_count (전체 수)를 반환한다', () => {
    expect(sql).toContain('recipient_count');
  });

  it('read_count (읽음 수)를 반환한다', () => {
    expect(sql).toContain('read_count');
    expect(sql).toContain('mr.read_at IS NOT NULL');
  });

  it('대상 이름을 반환한다 (class: 반이름, individual: 학생이름)', () => {
    expect(sql).toContain('target_name');
  });
});

describe('074: mark_message_read RPC', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/074_messaging.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('mark_message_read 함수가 정의된다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_message_read');
  });

  it('본인 수신 메시지만 읽음 처리한다', () => {
    expect(sql).toContain('recipient_id = v_user_id');
    expect(sql).toContain('read_at IS NULL');
  });

  it('SECURITY DEFINER로 정의된다', () => {
    const funcMatch = sql.match(/mark_message_read[\s\S]*?AS \$\$/);
    expect(funcMatch).not.toBeNull();
    expect(funcMatch![0]).toContain('SECURITY DEFINER');
  });
});

describe('074: get_unread_message_count RPC', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/074_messaging.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('get_unread_message_count 함수가 정의된다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_unread_message_count');
  });

  it('int를 반환한다', () => {
    expect(sql).toContain('RETURNS int');
  });

  it('read_at IS NULL인 수신 메시지만 카운트한다', () => {
    expect(sql).toContain('mr.read_at IS NULL');
    expect(sql).toContain('mr.recipient_id = auth.uid()');
  });
});

// ============================================================================
// P2: 서비스 레이어 mock 테스트
// ============================================================================

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
// P3: 에러 코드 / 상수 / 타입 통합
// ============================================================================

describe('에러 코드 통합', () => {
  const errorsPath = path.resolve(__dirname, '../../lib/errors.ts');
  let errorsSource: string;

  beforeAll(() => {
    errorsSource = fs.readFileSync(errorsPath, 'utf8');
  });

  it('MSG_BODY_REQUIRED 에러 코드가 정의된다', () => {
    expect(errorsSource).toContain("MSG_BODY_REQUIRED: 'MSG_BODY_REQUIRED'");
  });

  it('MSG_INVALID_TARGET_TYPE 에러 코드가 정의된다', () => {
    expect(errorsSource).toContain("MSG_INVALID_TARGET_TYPE: 'MSG_INVALID_TARGET_TYPE'");
  });

  it('MSG 에러 코드에 한국어 메시지가 있다', () => {
    expect(errorsSource).toContain('메시지 내용을 입력해주세요');
    expect(errorsSource).toContain('올바르지 않은 발송 대상입니다');
  });

  it('MSG 에러 코드가 카테고리에 매핑된다', () => {
    expect(errorsSource).toContain("MSG_BODY_REQUIRED: 'validation'");
    expect(errorsSource).toContain("MSG_INVALID_TARGET_TYPE: 'validation'");
  });

  it('MSG 에러 코드가 RPC_ERROR_MAP에 매핑된다', () => {
    expect(errorsSource).toContain("'MSG_BODY_REQUIRED': ERROR_CODES.MSG_BODY_REQUIRED");
    expect(errorsSource).toContain("'MSG_INVALID_TARGET_TYPE': ERROR_CODES.MSG_INVALID_TARGET_TYPE");
  });

  it('resource 타입에 message가 포함된다', () => {
    expect(errorsSource).toContain("'message'");
  });
});

describe('상수/타입 통합', () => {
  const constantsPath = path.resolve(__dirname, '../../lib/constants.ts');
  const typesPath = path.resolve(__dirname, '../../lib/types.ts');
  let constantsSource: string;
  let typesSource: string;

  beforeAll(() => {
    constantsSource = fs.readFileSync(constantsPath, 'utf8');
    typesSource = fs.readFileSync(typesPath, 'utf8');
  });

  it('NOTIFICATION_TYPES에 NEW_MESSAGE가 있다', () => {
    expect(constantsSource).toContain("NEW_MESSAGE: 'new_message'");
  });

  it('MESSAGE_TARGET_TYPES 상수가 정의된다', () => {
    expect(constantsSource).toContain("CLASS: 'class'");
    expect(constantsSource).toContain("INDIVIDUAL: 'individual'");
  });

  it('NotificationType에 new_message가 포함된다', () => {
    expect(typesSource).toContain("'new_message'");
  });

  it('MessageTargetType 타입이 정의된다', () => {
    expect(typesSource).toContain("export type MessageTargetType = 'class' | 'individual'");
  });
});

// ============================================================================
// P4: UI 레이아웃 연동 검증
// ============================================================================

describe('강사 레이아웃 연동', () => {
  const teacherLayoutPath = path.resolve(__dirname, '../../app/(teacher)/_layout.tsx');
  const teacherTabsPath = path.resolve(__dirname, '../../app/(teacher)/(tabs)/_layout.tsx');
  let teacherLayout: string;
  let teacherTabs: string;

  beforeAll(() => {
    teacherLayout = fs.readFileSync(teacherLayoutPath, 'utf8');
    teacherTabs = fs.readFileSync(teacherTabsPath, 'utf8');
  });

  it('(teacher)/_layout.tsx에 messages Stack.Screen이 등록된다', () => {
    expect(teacherLayout).toContain('name="messages"');
  });

  it('강사 탭 헤더에 getUnreadMessageCount import가 있다', () => {
    expect(teacherTabs).toContain("from '@/services/messages'");
    expect(teacherTabs).toContain('getUnreadMessageCount');
  });

  it('강사 탭 헤더에 메시지 아이콘이 있다', () => {
    expect(teacherTabs).toContain('chatbubbles-outline');
  });

  it('강사 탭 헤더에 메시지 뱃지가 있다', () => {
    expect(teacherTabs).toContain('msgBadge');
    expect(teacherTabs).toContain("msgBadge > 0");
  });

  it('헤더에서 메시지 화면으로 이동한다', () => {
    expect(teacherTabs).toContain("/(teacher)/messages/");
  });
});

describe('학생 레이아웃 연동', () => {
  const studentLayoutPath = path.resolve(__dirname, '../../app/(student)/_layout.tsx');
  const studentTabsPath = path.resolve(__dirname, '../../app/(student)/(tabs)/_layout.tsx');
  let studentLayout: string;
  let studentTabs: string;

  beforeAll(() => {
    studentLayout = fs.readFileSync(studentLayoutPath, 'utf8');
    studentTabs = fs.readFileSync(studentTabsPath, 'utf8');
  });

  it('(student)/_layout.tsx에 messages Stack.Screen이 등록된다', () => {
    expect(studentLayout).toContain('name="messages"');
  });

  it('학생 탭 헤더에 getUnreadMessageCount import가 있다', () => {
    expect(studentTabs).toContain("from '@/services/messages'");
  });

  it('학생 탭 헤더에 메시지 아이콘이 있다', () => {
    expect(studentTabs).toContain('mail-outline');
  });

  it('학생 탭 헤더에 메시지 뱃지가 있다', () => {
    expect(studentTabs).toContain('msgBadge');
  });

  it('헤더에서 메시지 화면으로 이동한다', () => {
    expect(studentTabs).toContain("/(student)/messages");
  });
});

describe('푸시 알림 네비게이션', () => {
  const pushPath = path.resolve(__dirname, '../../hooks/usePushNotifications.ts');
  let pushSource: string;

  beforeAll(() => {
    pushSource = fs.readFileSync(pushPath, 'utf8');
  });

  it('message_id로 메시지 화면으로 이동한다', () => {
    expect(pushSource).toContain('data.message_id');
    expect(pushSource).toContain("/(student)/messages");
  });
});

// ============================================================================
// P5: 서비스 파일 구조 검증
// ============================================================================

describe('services/messages.ts 구조', () => {
  const servicePath = path.resolve(__dirname, '../../services/messages.ts');
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(servicePath, 'utf8');
  });

  it('supabase import가 있다', () => {
    expect(source).toContain("from '@/lib/supabase'");
  });

  it('MessageTargetType import가 있다', () => {
    expect(source).toContain("from '@/lib/types'");
    expect(source).toContain('MessageTargetType');
  });

  it('classifyError와 classifyRpcError import가 있다', () => {
    expect(source).toContain("from '@/lib/errors'");
    expect(source).toContain('classifyError');
    expect(source).toContain('classifyRpcError');
  });

  it('ReceivedMessage 인터페이스가 정의된다', () => {
    expect(source).toContain('export interface ReceivedMessage');
    expect(source).toContain('sender_name: string');
    expect(source).toContain('read_at: string | null');
    expect(source).toContain('class_name: string | null');
  });

  it('SentMessage 인터페이스가 정의된다', () => {
    expect(source).toContain('export interface SentMessage');
    expect(source).toContain('recipient_count: number');
    expect(source).toContain('read_count: number');
    expect(source).toContain('target_name: string');
  });

  it('5개 함수가 export된다', () => {
    expect(source).toContain('export async function sendMessage');
    expect(source).toContain('export async function getMyMessages');
    expect(source).toContain('export async function getSentMessages');
    expect(source).toContain('export async function markMessageRead');
    expect(source).toContain('export async function getUnreadMessageCount');
  });
});

// ============================================================================
// P6: 강사 메시지 화면 검증
// ============================================================================

describe('강사 메시지 화면', () => {
  const indexPath = path.resolve(__dirname, '../../app/(teacher)/messages/index.tsx');
  const composePath = path.resolve(__dirname, '../../app/(teacher)/messages/compose.tsx');
  let indexSource: string;
  let composeSource: string;

  beforeAll(() => {
    indexSource = fs.readFileSync(indexPath, 'utf8');
    composeSource = fs.readFileSync(composePath, 'utf8');
  });

  it('index.tsx: getSentMessages를 호출한다', () => {
    expect(indexSource).toContain('getSentMessages');
  });

  it('index.tsx: 읽음 수/전체 수를 표시한다', () => {
    expect(indexSource).toContain('read_count');
    expect(indexSource).toContain('recipient_count');
    expect(indexSource).toContain('명 읽음');
  });

  it('index.tsx: FAB 버튼으로 compose로 이동한다', () => {
    expect(indexSource).toContain('compose');
    expect(indexSource).toContain('create-outline');
  });

  it('index.tsx: message-sent 이벤트를 구독한다', () => {
    expect(indexSource).toContain("on('message-sent'");
  });

  it('compose.tsx: getTeacherClasses와 getConnectedStudents를 로드한다', () => {
    expect(composeSource).toContain('getTeacherClasses');
    expect(composeSource).toContain('getConnectedStudents');
  });

  it('compose.tsx: sendMessage를 호출한다', () => {
    expect(composeSource).toContain('sendMessage');
  });

  it('compose.tsx: 반/학생 그룹으로 대상을 구분한다', () => {
    expect(composeSource).toContain("type === 'class'");
    expect(composeSource).toContain("type === 'individual'");
  });

  it('compose.tsx: message-sent 이벤트를 발행한다', () => {
    expect(composeSource).toContain("emit('message-sent')");
  });

  it('compose.tsx: URL 파라미터로 대상 프리셋을 지원한다', () => {
    expect(composeSource).toContain('targetType');
    expect(composeSource).toContain('targetId');
  });

  it('compose.tsx: xAlert로 에러/성공을 표시한다', () => {
    expect(composeSource).toContain('xAlert');
    expect(composeSource).toContain('발송 완료');
    expect(composeSource).toContain('발송 실패');
  });
});

// ============================================================================
// P7: 학생 메시지 화면 검증
// ============================================================================

describe('학생 메시지 화면', () => {
  const msgPath = path.resolve(__dirname, '../../app/(student)/messages.tsx');
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(msgPath, 'utf8');
  });

  it('getMyMessages를 호출한다', () => {
    expect(source).toContain('getMyMessages');
  });

  it('markMessageRead를 호출한다', () => {
    expect(source).toContain('markMessageRead');
  });

  it('미읽음 메시지를 시각적으로 구분한다', () => {
    expect(source).toContain('isUnread');
    expect(source).toContain('unreadDot');
  });

  it('읽음 처리 후 로컬 상태를 업데이트한다', () => {
    expect(source).toContain('read_at: new Date().toISOString()');
  });

  it('message-changed 이벤트를 발행한다', () => {
    expect(source).toContain("emit('message-changed')");
  });

  it('message-changed 이벤트를 구독한다', () => {
    expect(source).toContain("on('message-changed'");
  });

  it('발신자 이름과 반 이름을 표시한다', () => {
    expect(source).toContain('sender_name');
    expect(source).toContain('class_name');
  });

  it('빈 상태 메시지가 있다', () => {
    expect(source).toContain('받은 메시지가 없습니다');
  });
});
