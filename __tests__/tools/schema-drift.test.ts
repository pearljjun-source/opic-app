/**
 * 스키마 드리프트 검사기 테스트
 *
 * 이 검사기 자체가 틀리면 "DB와 일치합니다"라는 거짓 신호를 준다.
 * 가이드라인 A15 — **측정이 이상하면 도구를 먼저 의심한다.**
 * 그래서 파서·비교기를 고정 입력으로 검증한다.
 */

const {
  parseMigrations,
  diffSchema,
  stripSqlComments,
  readMigrations,
} = require('../../scripts/schema-drift.js');

type Migration = { name: string; sql: string };
type Expected = { tables: string[]; functions: string[]; types: string[]; origin: Record<string, string> };

const parse = (migrations: Migration[]): Expected => parseMigrations(migrations);

// ============================================================================
// 주석 제거 — 마이그레이션 헤더에 옛 구조를 설명으로 적어두는 일이 흔하다
// ============================================================================

describe('stripSqlComments', () => {
  it('줄 주석을 걷어낸다', () => {
    expect(stripSqlComments('-- CREATE TABLE public.ghost\nSELECT 1')).not.toContain('ghost');
  });

  it('블록 주석을 걷어낸다', () => {
    expect(stripSqlComments('/* CREATE TABLE public.ghost */ SELECT 1')).not.toContain('ghost');
  });

  it('주석 안의 CREATE는 객체로 잡히지 않는다', () => {
    const parsed = parse([
      { name: '001.sql', sql: '-- 이전에는 CREATE TABLE public.old_users 였다\nCREATE TABLE public.users (id uuid);' },
    ]);
    expect(parsed.tables).toEqual(['users']);
  });
});

// ============================================================================
// 파싱
// ============================================================================

describe('parseMigrations — 생성 구문', () => {
  it('테이블·함수·ENUM을 뽑는다', () => {
    const parsed = parse([{
      name: '001.sql',
      sql: `
        CREATE TYPE public.user_role AS ENUM ('a','b');
        CREATE TABLE public.users (id uuid);
        CREATE FUNCTION public.get_user() RETURNS void AS $$ BEGIN END; $$;
      `,
    }]);

    expect(parsed.tables).toEqual(['users']);
    expect(parsed.functions).toEqual(['get_user']);
    expect(parsed.types).toEqual(['user_role']);
  });

  it('IF NOT EXISTS / OR REPLACE / public. 생략 형태를 모두 인식한다', () => {
    const parsed = parse([{
      name: '001.sql',
      sql: `
        CREATE TABLE IF NOT EXISTS public.a (id int);
        CREATE TABLE b (id int);
        CREATE OR REPLACE FUNCTION public.f1() RETURNS void AS $$ BEGIN END; $$;
        CREATE FUNCTION f2(p_x uuid) RETURNS void AS $$ BEGIN END; $$;
      `,
    }]);

    expect(parsed.tables).toEqual(['a', 'b']);
    expect(parsed.functions).toEqual(['f1', 'f2']);
  });

  it('어느 파일에서 왔는지 기록한다 (미적용 시 안내용)', () => {
    const parsed = parse([
      { name: '001_init.sql', sql: 'CREATE TABLE public.users (id uuid);' },
      { name: '076_daily_goals.sql', sql: 'CREATE TABLE public.daily_goals (id uuid);' },
    ]);

    expect(parsed.origin['table:daily_goals']).toBe('076_daily_goals.sql');
  });
});

describe('parseMigrations — 순차 재생(replay)', () => {
  it('나중 마이그레이션에서 DROP되면 기대 목록에서 빠진다', () => {
    const parsed = parse([
      { name: '001.sql', sql: 'CREATE FUNCTION public.create_organization() RETURNS void AS $$ BEGIN END; $$;' },
      { name: '053.sql', sql: 'DROP FUNCTION IF EXISTS public.create_organization();' },
    ]);

    expect(parsed.functions).toEqual([]);
  });

  it('DROP 후 재생성되면 다시 기대 목록에 들어간다 (가장 흔한 패턴)', () => {
    const parsed = parse([
      { name: '065.sql', sql: 'CREATE FUNCTION public.get_topics() RETURNS void AS $$ BEGIN END; $$;' },
      {
        name: '079.sql',
        sql: `
          DROP FUNCTION IF EXISTS public.get_topics(uuid);
          CREATE OR REPLACE FUNCTION public.get_topics() RETURNS void AS $$ BEGIN END; $$;
        `,
      },
    ]);

    expect(parsed.functions).toEqual(['get_topics']);
    expect(parsed.origin['function:get_topics']).toBe('079.sql');
  });

  it('같은 파일 안에서 DROP 후 CREATE 하면 남는다 (순서를 지킨다)', () => {
    const parsed = parse([{
      name: '079.sql',
      sql: `
        DROP FUNCTION IF EXISTS public.f();
        CREATE OR REPLACE FUNCTION public.f() RETURNS void AS $$ BEGIN END; $$;
      `,
    }]);

    expect(parsed.functions).toEqual(['f']);
  });

  it('테이블 DROP도 반영한다', () => {
    const parsed = parse([
      { name: '001.sql', sql: 'CREATE TABLE public.tmp (id int);' },
      { name: '002.sql', sql: 'DROP TABLE public.tmp;' },
    ]);

    expect(parsed.tables).toEqual([]);
  });
});

// ============================================================================
// 비교
// ============================================================================

describe('diffSchema', () => {
  const expected = { tables: ['users', 'daily_goals'], functions: ['get_weak_areas'], types: ['org_role'] };

  it('DB에 없는 객체를 찾아낸다', () => {
    const missing = diffSchema(expected, {
      tables: ['users'],
      functions: [],
      types: ['org_role'],
    });

    expect(missing.tables).toEqual(['daily_goals']);
    expect(missing.functions).toEqual(['get_weak_areas']);
    expect(missing.types).toEqual([]);
  });

  it('전부 있으면 비어 있다', () => {
    const missing = diffSchema(expected, {
      tables: ['users', 'daily_goals'],
      functions: ['get_weak_areas'],
      types: ['org_role'],
    });

    expect(missing.tables.concat(missing.functions, missing.types)).toEqual([]);
  });

  it('DB에만 있는 객체는 실패로 보지 않는다 (수동 생성·확장 스키마 허용)', () => {
    const missing = diffSchema(expected, {
      tables: ['users', 'daily_goals', 'some_manual_table'],
      functions: ['get_weak_areas', 'pg_stat_helper'],
      types: ['org_role'],
    });

    expect(missing.tables).toEqual([]);
    expect(missing.functions).toEqual([]);
  });
});

// ============================================================================
// 실제 마이그레이션 폴더에 대해 동작하는지
// ============================================================================

describe('실제 supabase/migrations', () => {
  it('파일을 읽어 객체를 뽑아낸다', () => {
    const parsed = parse(readMigrations());

    expect(parsed.tables.length).toBeGreaterThan(20);
    expect(parsed.functions.length).toBeGreaterThan(50);
    expect(parsed.tables).toContain('users');
    expect(parsed.tables).toContain('practices');
  });

  it('053에서 삭제된 create_organization은 기대 목록에 없다', () => {
    // 셀프 서비스 학원 생성은 보안상 제거됐다 — 되살아나면 여기서 걸린다
    expect(parse(readMigrations()).functions).not.toContain('create_organization');
  });
});
