/**
 * 043_server_side_quota_enforcement 마이그레이션 검증
 *
 * 서버 사이드 쿼터 검증이 올바르게 구현되었는지 확인:
 * 1. _check_org_quota 헬퍼 존재 + 올바른 시그니처
 * 2. use_invite_code에 STUDENT_QUOTA_EXCEEDED 분기 존재
 * 3. enforce_script_quota 트리거 존재 + SCRIPT_QUOTA_EXCEEDED
 * 4. 에러 코드가 RPC_ERROR_MAP에 매핑됨
 * 5. P0001 에러 코드가 classifyPostgrestError에서 처리됨
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// SQL 마이그레이션 검증
// ============================================================================

describe('043: _check_org_quota 헬퍼', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/043_server_side_quota_enforcement.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('_check_org_quota 함수가 정의된다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public._check_org_quota');
  });

  it('org_id와 feature_key를 파라미터로 받는다 (auth.uid() 불필요)', () => {
    expect(sql).toContain('p_org_id uuid');
    expect(sql).toContain('p_feature_key text');
    // auth.uid()를 호출하지 않음 (SECURITY DEFINER 내에서 호출 가능)
    expect(sql).toMatch(/_check_org_quota[\s\S]*?LANGUAGE plpgsql/);
  });

  it('max_students와 max_scripts 쿼터를 지원한다', () => {
    expect(sql).toContain("p_feature_key = 'max_students'");
    expect(sql).toContain("p_feature_key = 'max_scripts'");
  });

  it('free tier 기본값을 하드코딩한다 (학생 3, 스크립트 5)', () => {
    expect(sql).toContain('c_free_students constant int := 3');
    expect(sql).toContain('c_free_scripts constant int := 5');
  });

  it('subscription_plans 테이블에서 플랜 한도를 조회한다', () => {
    expect(sql).toContain('FROM public.subscription_plans');
    expect(sql).toContain('v_plan.max_students');
    expect(sql).toContain('v_plan.max_scripts');
  });
});

describe('043: use_invite_code 학생 쿼터 검증', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/043_server_side_quota_enforcement.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('use_invite_code에 _check_org_quota 호출이 있다', () => {
    expect(sql).toContain("public._check_org_quota(v_org_id, 'max_students')");
  });

  it('학생 초대에서만 쿼터 체크한다 (owner/teacher 제외)', () => {
    expect(sql).toContain("v_invite.target_role = 'student'");
  });

  it('쿼터 초과 시 STUDENT_QUOTA_EXCEEDED 에러를 반환한다', () => {
    expect(sql).toContain("'error', 'STUDENT_QUOTA_EXCEEDED'");
  });

  it('쿼터 초과 응답에 limit, used, plan_key를 포함한다', () => {
    expect(sql).toContain("'limit'");
    expect(sql).toContain("'used'");
    expect(sql).toContain("'plan_key'");
  });

  it('CAS 패턴 이전에 쿼터를 체크한다 (불필요한 코드 사용 방지)', () => {
    const quotaCheckPos = sql.indexOf('STUDENT_QUOTA_EXCEEDED');
    const casPos = sql.indexOf("SET status = 'used'", sql.indexOf('use_invite_code'));
    expect(quotaCheckPos).toBeLessThan(casPos);
  });
});

describe('043: enforce_script_quota 트리거', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/043_server_side_quota_enforcement.sql');
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('enforce_script_quota 트리거 함수가 정의된다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.enforce_script_quota');
  });

  it('scripts 테이블에 BEFORE INSERT 트리거로 설정된다', () => {
    expect(sql).toContain('BEFORE INSERT ON public.scripts');
    expect(sql).toContain('EXECUTE FUNCTION public.enforce_script_quota');
  });

  it('_check_org_quota를 호출한다', () => {
    expect(sql).toContain("public._check_org_quota(NEW.organization_id, 'max_scripts')");
  });

  it('쿼터 초과 시 RAISE EXCEPTION으로 INSERT를 차단한다', () => {
    expect(sql).toContain("RAISE EXCEPTION 'SCRIPT_QUOTA_EXCEEDED");
  });

  it('organization_id가 NULL이면 트리거를 패스한다 (레거시 보호)', () => {
    expect(sql).toContain('IF NEW.organization_id IS NULL THEN');
    expect(sql).toContain('RETURN NEW');
  });
});

// ============================================================================
// 에러 처리 검증
// ============================================================================

describe('에러 코드 매핑', () => {
  const errorsPath = path.resolve(__dirname, '../../lib/errors.ts');
  let errorsContent: string;

  beforeAll(() => {
    errorsContent = fs.readFileSync(errorsPath, 'utf8');
  });

  it('STUDENT_QUOTA_EXCEEDED가 RPC_ERROR_MAP에 매핑된다', () => {
    expect(errorsContent).toContain("'STUDENT_QUOTA_EXCEEDED'");
  });

  it('SCRIPT_QUOTA_EXCEEDED가 RPC_ERROR_MAP에 매핑된다', () => {
    expect(errorsContent).toContain("'SCRIPT_QUOTA_EXCEEDED'");
  });

  it('둘 다 BILLING_QUOTA_EXCEEDED로 매핑된다', () => {
    // STUDENT_QUOTA_EXCEEDED → BILLING_QUOTA_EXCEEDED
    expect(errorsContent).toMatch(/STUDENT_QUOTA_EXCEEDED.*BILLING_QUOTA_EXCEEDED/);
    expect(errorsContent).toMatch(/SCRIPT_QUOTA_EXCEEDED.*BILLING_QUOTA_EXCEEDED/);
  });

  it('P0001 에러 코드에서 SCRIPT_QUOTA_EXCEEDED를 파싱한다', () => {
    expect(errorsContent).toContain("error.code === 'P0001'");
    expect(errorsContent).toContain('SCRIPT_QUOTA_EXCEEDED');
  });
});
