/**
 * 044_add_trend_data_to_practice_stats 마이그레이션 검증
 *
 * get_student_practice_stats RPC에 트렌드 데이터가 올바르게 추가되었는지 확인:
 * 1. prev_avg_score, prev_avg_reproduction_rate 서브쿼리 존재
 * 2. 7~14일 전 기간 필터링 (이전주 데이터)
 * 3. target_opic_grade 반환
 * 4. 인가 로직 유지 (본인/연결 강사/super_admin)
 * 5. StudentPracticeStats 타입과 RPC 반환 필드 일치
 */

import * as fs from 'fs';
import * as path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../supabase/migrations/044_add_trend_data_to_practice_stats.sql'
);

describe('044: get_student_practice_stats 트렌드 데이터', () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  // ========================================
  // 기본 구조
  // ========================================

  it('get_student_practice_stats 함수를 재정의한다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_student_practice_stats');
  });

  it('기존 함수를 DROP 후 재생성한다 (시그니처 호환)', () => {
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.get_student_practice_stats(uuid)');
  });

  it('SECURITY DEFINER + search_path 빈 문자열로 설정한다', () => {
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path = ''");
  });

  // ========================================
  // 인가 로직 유지 확인
  // ========================================

  it('auth.uid() 인증 체크가 있다', () => {
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('NOT_AUTHENTICATED');
  });

  it('본인 조회 허용 (v_caller_id = p_student_id)', () => {
    expect(sql).toContain('v_caller_id = p_student_id');
  });

  it('연결된 강사 체크 (teacher_student 테이블)', () => {
    expect(sql).toContain('public.teacher_student');
    expect(sql).toContain('teacher_id = v_caller_id');
    expect(sql).toContain('student_id = p_student_id');
  });

  it('super_admin 체크', () => {
    expect(sql).toContain('public.is_super_admin()');
  });

  it('미인가 시 UNAUTHORIZED 반환', () => {
    expect(sql).toContain('UNAUTHORIZED');
  });

  // ========================================
  // 기존 통계 필드 유지
  // ========================================

  it('기존 6개 통계 필드를 유지한다', () => {
    expect(sql).toContain("'total_practices'");
    expect(sql).toContain("'total_duration_minutes'");
    expect(sql).toContain("'avg_score'");
    expect(sql).toContain("'avg_reproduction_rate'");
    expect(sql).toContain("'this_week_practices'");
    expect(sql).toContain("'last_practice_at'");
  });

  // ========================================
  // 트렌드 데이터 (신규)
  // ========================================

  it('prev_avg_score 서브쿼리가 있다', () => {
    expect(sql).toContain("'prev_avg_score'");
  });

  it('prev_avg_reproduction_rate 서브쿼리가 있다', () => {
    expect(sql).toContain("'prev_avg_reproduction_rate'");
  });

  it('7~14일 전 기간 필터링을 사용한다 (이전주)', () => {
    expect(sql).toContain("now() - interval '14 days'");
    expect(sql).toContain("now() - interval '7 days'");
  });

  it('이전주 서브쿼리에서 deleted_at IS NULL을 체크한다', () => {
    // 서브쿼리 내에서 p2.deleted_at IS NULL
    expect(sql).toContain('p2.deleted_at IS NULL');
  });

  it('이전주 데이터가 없으면 null을 반환한다 (COALESCE null)', () => {
    // COALESCE(ROUND(AVG(...), 1), null)
    const prevAvgMatches = sql.match(/COALESCE\(ROUND\(AVG\(p2\.\w+\)::numeric, 1\), null\)/g);
    expect(prevAvgMatches).toHaveLength(2); // score + reproduction_rate
  });

  // ========================================
  // target_opic_grade
  // ========================================

  it('target_opic_grade를 teacher_student에서 조회한다', () => {
    expect(sql).toContain('ts.target_opic_grade');
    expect(sql).toContain("'target_opic_grade'");
  });

  // ========================================
  // 테이블 alias 사용 (42702 ambiguity 방지)
  // ========================================

  it('메인 쿼리에서 테이블 alias를 사용한다 (p.created_at)', () => {
    expect(sql).toContain('p.created_at');
    expect(sql).toContain('p.student_id');
    expect(sql).toContain('p.deleted_at');
  });

  it('서브쿼리에서 테이블 alias를 사용한다 (p2.score, p2.created_at)', () => {
    expect(sql).toContain('p2.score');
    expect(sql).toContain('p2.reproduction_rate');
    expect(sql).toContain('p2.created_at');
    expect(sql).toContain('p2.student_id');
  });
});

// ============================================================================
// StudentPracticeStats 타입과 RPC 반환 필드 일치 확인
// ============================================================================

describe('StudentPracticeStats 타입 — RPC 필드 일치', () => {
  let typesContent: string;

  beforeAll(() => {
    const typesPath = path.resolve(__dirname, '../../lib/types.ts');
    typesContent = fs.readFileSync(typesPath, 'utf8');
  });

  it('StudentPracticeStats 인터페이스가 정의되어 있다', () => {
    expect(typesContent).toContain('export interface StudentPracticeStats');
  });

  const requiredFields = [
    'total_practices',
    'total_duration_minutes',
    'avg_score',
    'avg_reproduction_rate',
    'this_week_practices',
    'last_practice_at',
    'prev_avg_score',
    'prev_avg_reproduction_rate',
    'target_opic_grade',
  ];

  for (const field of requiredFields) {
    it(`${field} 필드가 타입에 정의되어 있다`, () => {
      expect(typesContent).toContain(field);
    });
  }
});
