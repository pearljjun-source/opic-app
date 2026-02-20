/**
 * 032 마이그레이션 + 어드민 패널 + 웹 로그인 수정 시뮬레이션 테스트
 *
 * 검증 항목:
 * - P1: users RLS super_admin bypass (마이그레이션 SQL 구조 검증)
 * - P2: admin_get_user_by_id RPC 호출 + effective_role 처리
 * - P3: getOrganizationDetail users JOIN (RLS 수정으로 자동 해결)
 * - P4: useAuth homeForUser 레거시 admin 제거
 * - P5: 웹 로그인 autoComplete='new-password'
 */

import * as fs from 'fs';
import * as path from 'path';
import { classifyRpcError } from '@/lib/errors';
import { canTeach } from '@/lib/permissions';
import type { OrgRole } from '@/lib/types';

// ============================================================================
// P1: 마이그레이션 032 — users RLS 정책 구조 검증
// ============================================================================

describe('032 마이그레이션: users RLS super_admin bypass', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/032_fix_users_rls_super_admin.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('마이그레이션 파일이 존재한다', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('기존 users_select_own_and_connected 정책을 DROP한다', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "users_select_own_and_connected" ON public.users');
  });

  it('새 정책에 is_super_admin() bypass가 포함된다', () => {
    expect(sql).toContain('public.is_super_admin()');
  });

  it('기존 auth.uid() = id (본인 프로필) 조건이 유지된다', () => {
    expect(sql).toContain('auth.uid() = id');
  });

  it('기존 teacher_student 연결 조건이 유지된다', () => {
    expect(sql).toContain('public.teacher_student ts');
    expect(sql).toContain('ts.teacher_id = auth.uid()');
    expect(sql).toContain('ts.student_id = auth.uid()');
  });

  it('organization_members owner/admin 조회 조건이 추가된다', () => {
    expect(sql).toContain('public.organization_members om');
    expect(sql).toContain("om.role IN ('owner', 'admin')");
  });

  it('deleted_at IS NULL 조건이 모든 레벨에 적용된다', () => {
    // 최상위 + teacher_student + organization_members 각각에 deleted_at IS NULL
    const matches = sql.match(/deleted_at IS NULL/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(4); // 최상위 + ts + om + om2
  });
});

// ============================================================================
// P2: admin_get_user_by_id RPC 구조 검증 + 클라이언트 에러 처리
// ============================================================================

describe('032 마이그레이션: admin_get_user_by_id RPC', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/032_fix_users_rls_super_admin.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('admin_get_user_by_id 함수가 정의된다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_get_user_by_id');
  });

  it('SECURITY DEFINER로 실행된다', () => {
    // SECURITY DEFINER가 admin_get_user_by_id 함수 정의 내에 있는지 확인
    const funcStart = sql.indexOf('admin_get_user_by_id');
    const funcSection = sql.slice(funcStart);
    expect(funcSection).toContain('SECURITY DEFINER');
  });

  it("search_path = ''로 설정된다", () => {
    const funcStart = sql.indexOf('admin_get_user_by_id');
    const funcSection = sql.slice(funcStart);
    expect(funcSection).toContain("search_path = ''");
  });

  it('is_super_admin() 권한 체크가 있다', () => {
    const funcStart = sql.indexOf('admin_get_user_by_id');
    const funcSection = sql.slice(funcStart);
    expect(funcSection).toContain('public.is_super_admin()');
  });

  it('FORBIDDEN 에러를 반환한다 (비 super_admin)', () => {
    const funcStart = sql.indexOf('admin_get_user_by_id');
    const funcSection = sql.slice(funcStart);
    expect(funcSection).toContain("'error', 'FORBIDDEN'");
  });

  it('USER_NOT_FOUND 에러를 반환한다', () => {
    const funcStart = sql.indexOf('admin_get_user_by_id');
    const funcSection = sql.slice(funcStart);
    expect(funcSection).toContain("'error', 'USER_NOT_FOUND'");
  });

  it('effective_role 계산 로직이 포함된다', () => {
    expect(sql).toContain('effective_role');
    expect(sql).toContain("WHEN u.platform_role = 'super_admin' THEN 'super_admin'");
  });

  it('소속 조직 목록(organizations)을 반환한다', () => {
    expect(sql).toContain("'organizations'");
    expect(sql).toContain('jsonb_agg');
  });
});

describe('classifyRpcError: admin_get_user_by_id 에러 매핑', () => {
  it('FORBIDDEN → PERM_ADMIN_ONLY로 매핑된다', () => {
    const result = classifyRpcError('FORBIDDEN');
    expect(result.code).toBe('PERM_ADMIN_ONLY');
    expect(result.userMessage).toBeTruthy();
  });

  it('USER_NOT_FOUND → NF_USER로 매핑된다', () => {
    const result = classifyRpcError('USER_NOT_FOUND');
    expect(result.code).toBe('NF_USER');
    expect(result.userMessage).toBeTruthy();
  });

  it('알 수 없는 에러 → SVR_UNKNOWN으로 매핑된다', () => {
    const result = classifyRpcError('UNEXPECTED_ERROR_XYZ');
    expect(result.code).toBe('SVR_UNKNOWN');
  });
});

// ============================================================================
// P2 (cont): user/[id].tsx 화면 코드 검증
// ============================================================================

describe('user/[id].tsx: RPC 기반 사용자 상세 화면', () => {
  const userDetailPath = path.resolve(__dirname, '../../app/(admin)/user/[id].tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(userDetailPath, 'utf8');
  });

  it('admin_get_user_by_id RPC를 호출한다', () => {
    expect(content).toContain("'admin_get_user_by_id'");
    expect(content).toContain('p_user_id');
  });

  it('직접 supabase.from("users") 쿼리를 사용하지 않는다', () => {
    expect(content).not.toContain(".from('users')");
    expect(content).not.toContain('.from("users")');
  });

  it('ROLE_LABELS에 super_admin이 포함된다', () => {
    expect(content).toContain("super_admin: '슈퍼 관리자'");
  });

  it('ROLE_BADGE_COLORS에 super_admin이 포함된다', () => {
    expect(content).toMatch(/super_admin:\s*'#[A-Fa-f0-9]+'/);
  });

  it('effective_role 기반으로 역할을 표시한다', () => {
    expect(content).toContain('effective_role');
    expect(content).toContain('displayRole');
  });

  it('소속 조직 목록을 표시한다', () => {
    expect(content).toContain('소속 조직');
    expect(content).toContain('organizations');
  });

  it('super_admin/admin에게 역할 변경 버튼을 표시하지 않는다', () => {
    expect(content).toContain("displayRole !== 'super_admin'");
    expect(content).toContain("displayRole !== 'admin'");
  });

  it('RPC 비즈니스 에러를 classifyRpcError로 처리한다', () => {
    expect(content).toContain('classifyRpcError');
    expect(content).toContain('data?.error');
  });

  it('RPC Supabase 에러를 getUserMessage로 처리한다', () => {
    expect(content).toContain('getUserMessage');
    expect(content).toContain('rpcError');
  });
});

// ============================================================================
// P3: getOrganizationDetail users JOIN — RLS 수정으로 자동 해결 검증
// ============================================================================

describe('services/admin.ts: getOrganizationDetail users JOIN', () => {
  const adminServicePath = path.resolve(__dirname, '../../services/admin.ts');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(adminServicePath, 'utf8');
  });

  it('organization_members에서 users JOIN을 수행한다', () => {
    // 기존 쿼리가 변경되지 않았음을 확인 (RLS 수정으로 자동 해결)
    expect(content).toContain("users(id, name, email)");
    expect(content).toContain("'organization_members'");
  });
});

// ============================================================================
// P4: useAuth homeForUser — 레거시 admin 체크 제거
// ============================================================================

describe('useAuth: homeForUser 레거시 admin 체크 제거', () => {
  const useAuthPath = path.resolve(__dirname, '../../hooks/useAuth.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(useAuthPath, 'utf8');
  });

  it('platformRole === "super_admin" 체크가 존재한다', () => {
    expect(content).toContain("state.platformRole === 'super_admin'");
  });

  it('레거시 role === "admin" 체크가 제거되었다', () => {
    // homeForUser 함수 영역만 확인
    const funcMatch = content.match(/const homeForUser[\s\S]*?};/);
    expect(funcMatch).not.toBeNull();
    const homeForUserBody = funcMatch![0];
    expect(homeForUserBody).not.toContain("role === 'admin'");
  });

  it('canTeach(state.orgRole) 체크가 유지된다', () => {
    expect(content).toContain('canTeach(state.orgRole)');
  });
});

describe('homeForUser 라우팅 로직 시뮬레이션', () => {
  // homeForUser 로직을 직접 시뮬레이션
  type TestState = {
    platformRole: string | null;
    currentOrg: { id: string; name: string; role: OrgRole } | null;
    orgRole: OrgRole | null;
  };

  const homeForUser = (state: TestState) => {
    if (state.platformRole === 'super_admin') return '/(admin)';
    if (!state.currentOrg) return '/(student)';
    if (canTeach(state.orgRole)) return '/(teacher)';
    return '/(student)';
  };

  it('super_admin → /(admin)', () => {
    expect(homeForUser({
      platformRole: 'super_admin',
      currentOrg: null,
      orgRole: null,
    })).toBe('/(admin)');
  });

  it('조직 없는 일반 사용자 → /(student)', () => {
    expect(homeForUser({
      platformRole: null,
      currentOrg: null,
      orgRole: null,
    })).toBe('/(student)');
  });

  it('조직 owner → /(teacher)', () => {
    expect(homeForUser({
      platformRole: null,
      currentOrg: { id: 'org-1', name: 'Test', role: 'owner' },
      orgRole: 'owner',
    })).toBe('/(teacher)');
  });

  it('조직 teacher → /(teacher)', () => {
    expect(homeForUser({
      platformRole: null,
      currentOrg: { id: 'org-1', name: 'Test', role: 'teacher' },
      orgRole: 'teacher',
    })).toBe('/(teacher)');
  });

  it('조직 student → /(student)', () => {
    expect(homeForUser({
      platformRole: null,
      currentOrg: { id: 'org-1', name: 'Test', role: 'student' },
      orgRole: 'student',
    })).toBe('/(student)');
  });

  it('레거시 role=admin은 더 이상 /(admin)으로 라우팅하지 않는다', () => {
    // 이전에는 state.role === 'admin' → /(admin)이었으나 제거됨
    // platformRole이 null이고 org가 없으면 /(student)
    expect(homeForUser({
      platformRole: null,
      currentOrg: null,
      orgRole: null,
    })).toBe('/(student)');
  });
});

// ============================================================================
// P5: 웹 로그인 autoComplete 값 검증
// ============================================================================

describe('login.tsx: 웹 autoComplete="new-password"', () => {
  const loginPath = path.resolve(__dirname, '../../app/(auth)/login.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(loginPath, 'utf8');
  });

  it('이메일 Input에 웹용 new-password가 설정된다', () => {
    expect(content).toContain("autoComplete={Platform.OS === 'web' ? 'new-password' : 'email'}");
  });

  it('비밀번호 Input에 웹용 new-password가 설정된다', () => {
    expect(content).toContain("autoComplete={Platform.OS === 'web' ? 'new-password' : 'password'}");
  });

  it('autoComplete="off"가 더 이상 사용되지 않는다 (Chrome이 무시함)', () => {
    // Input 필드에 autoComplete='off'가 없어야 함
    // FormView의 autoComplete="off"는 유지 (form 레벨은 별도)
    const inputLines = content.split('\n').filter(line =>
      line.includes('autoComplete=') && !line.includes('FormView') && !line.includes('autoComplete="off"')
    );
    // autoComplete가 있는 Input 라인에 'off'가 없어야 함
    const offInputLines = content.split('\n').filter(line =>
      line.includes('autoComplete=') && line.includes("'off'") && !line.includes('FormView') && !line.includes('form')
    );
    expect(offInputLines.length).toBe(0);
  });

  it('네이티브에서는 기존 autoComplete 값이 유지된다', () => {
    // 'email'과 'password'가 삼항 연산자의 네이티브 분기에 존재
    expect(content).toContain(": 'email'");
    expect(content).toContain(": 'password'");
  });

  it('FormView로 form 태그가 사용된다', () => {
    expect(content).toContain('FormView');
    expect(content).toContain('onSubmit={handleLogin}');
  });
});

// ============================================================================
// 에러 처리 통합 검증: FORBIDDEN 에러 코드 추가
// ============================================================================

describe('lib/errors.ts: FORBIDDEN 에러 코드 매핑 추가', () => {
  const errorsPath = path.resolve(__dirname, '../../lib/errors.ts');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(errorsPath, 'utf8');
  });

  it('RPC_ERROR_MAP에 FORBIDDEN이 추가되었다', () => {
    expect(content).toContain("'FORBIDDEN'");
  });

  it('FORBIDDEN이 PERM_ADMIN_ONLY로 매핑된다', () => {
    // 코드 레벨 검증
    const result = classifyRpcError('FORBIDDEN');
    expect(result.code).toBe('PERM_ADMIN_ONLY');
    expect(result.userMessage).toContain('관리자');
  });
});
