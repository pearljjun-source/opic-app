/**
 * 스키마 드리프트 검사 — 마이그레이션 파일 ↔ 실제 DB 대조
 *
 * ## 왜 필요한가
 *
 * 2026-08-28 확인 시점에 060(webhook_logs·email_logs), 076(daily_goals),
 * 077(get_weak_areas)이 **파일에는 있는데 DB에는 없었다.** 076·077은 이미 앱에
 * 배포되어 학생 대시보드가 호출하고 있었으므로 프로덕션에서 실패 중이었는데,
 * 테스트 865개는 전부 통과했다 — 파일 문자열만 봤기 때문이다.
 *
 * `supabase_migrations.schema_migrations` 이력도 신뢰할 수 없었다(057~077 구간이
 * 실제 스키마와 어긋나 있었다). 그래서 이력이 아니라 **객체의 실존**을 본다.
 *
 * ## 사용법
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run check:schema
 *   npm run check:schema -- --dry     # 토큰 없이 파싱 결과만 출력
 *
 * 프로젝트는 SUPABASE_PROJECT_REF 로 바꿀 수 있다.
 *
 * ⚠️ 토큰을 저장소에 넣지 않는다. CI 시크릿이나 셸 환경변수로만 넘긴다.
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations');
const DEFAULT_PROJECT_REF = 'nnneyjvcbevwmsvvundr';

// ============================================================================
// 파싱 — 마이그레이션이 "있어야 한다"고 말하는 객체들
// ============================================================================

/**
 * SQL에서 생성/삭제되는 객체를 뽑는다.
 *
 * ⚠️ 주석은 먼저 걷어낸다. 마이그레이션 헤더에 이전 구조를 설명하며
 *    `CREATE TABLE ...` 을 적어 두는 일이 흔하다.
 */
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // 블록 주석
    .replace(/--[^\n]*/g, ' ');          // 줄 주석
}

const PATTERNS = {
  table: {
    create: /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    drop: /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
  },
  function: {
    create: /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi,
    drop: /\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
  },
  type: {
    create: /\bCREATE\s+TYPE\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    drop: /\bDROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
  },
};

function matchAll(sql, re) {
  const out = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(sql)) !== null) out.push(m[1].toLowerCase());
  return out;
}

/**
 * 마이그레이션 목록을 순서대로 훑어 "최종적으로 존재해야 하는" 객체를 계산한다.
 *
 * ⚠️ DROP 후 재생성되는 경우가 많다(`DROP FUNCTION` → `CREATE OR REPLACE FUNCTION`).
 *    파일 순서대로 적용하며 마지막 상태만 남긴다. 그래서 단순 집합 연산이 아니라
 *    순차 재생(replay)이다.
 *
 * @param {{name: string, sql: string}[]} migrations 파일명 오름차순
 * @returns {{tables: string[], functions: string[], types: string[], origin: Record<string,string>}}
 */
function parseMigrations(migrations) {
  const state = { table: new Map(), function: new Map(), type: new Map() };

  for (const { name, sql } of migrations) {
    const clean = stripSqlComments(sql);

    for (const kind of Object.keys(PATTERNS)) {
      for (const dropped of matchAll(clean, PATTERNS[kind].drop)) {
        state[kind].delete(dropped);
      }
      for (const created of matchAll(clean, PATTERNS[kind].create)) {
        state[kind].set(created, name);
      }
    }
  }

  const origin = {};
  for (const kind of Object.keys(state)) {
    for (const [obj, file] of state[kind]) origin[`${kind}:${obj}`] = file;
  }

  return {
    tables: [...state.table.keys()].sort(),
    functions: [...state.function.keys()].sort(),
    types: [...state.type.keys()].sort(),
    origin,
  };
}

/** 기대 목록과 실제 DB 목록을 비교한다 */
function diffSchema(expected, actual) {
  const missing = (want, have) => want.filter((o) => !have.includes(o));

  return {
    tables: missing(expected.tables, actual.tables),
    functions: missing(expected.functions, actual.functions),
    types: missing(expected.types, actual.types),
  };
}

function readMigrations(dir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), 'utf8') }));
}

// ============================================================================
// 실제 DB 조회 (Supabase Management API)
// ============================================================================

const ACTUAL_SCHEMA_SQL = `
  SELECT 'table' AS kind, table_name AS name
    FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  UNION ALL
  SELECT 'function', p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
  UNION ALL
  SELECT 'type', t.typname
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' AND t.typtype = 'e'
`;

async function fetchActualSchema(projectRef, token) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // keep-alive 소켓이 남으면 종료 시 libuv가 죽는다(Windows: UV_HANDLE_CLOSING assert).
        // 한 번만 쓰는 요청이므로 서버가 바로 닫게 한다.
        Connection: 'close',
      },
      body: JSON.stringify({ query: ACTUAL_SCHEMA_SQL }),
    },
  );

  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const rows = await res.json();
  const pick = (kind) => rows.filter((r) => r.kind === kind).map((r) => r.name.toLowerCase());

  return { tables: pick('table'), functions: pick('function'), types: pick('type') };
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const dry = process.argv.includes('--dry');
  const expected = parseMigrations(readMigrations());

  console.log(
    `마이그레이션 ${readMigrations().length}개 → 테이블 ${expected.tables.length} · ` +
    `함수 ${expected.functions.length} · ENUM ${expected.types.length}`,
  );

  if (dry) {
    console.log('\n[--dry] DB 조회를 건너뜁니다.');
    console.log('테이블:', expected.tables.join(', '));
    console.log('\nENUM:', expected.types.join(', '));
    return 0;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error('\n✗ SUPABASE_ACCESS_TOKEN 이 없습니다.');
    console.error('  SUPABASE_ACCESS_TOKEN=sbp_xxx npm run check:schema');
    console.error('  (파싱 결과만 보려면: npm run check:schema -- --dry)');
    return 2;
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF || DEFAULT_PROJECT_REF;
  const actual = await fetchActualSchema(projectRef, token);
  const missing = diffSchema(expected, actual);

  const total = missing.tables.length + missing.functions.length + missing.types.length;
  if (total === 0) {
    console.log(`\n✓ ${projectRef}: 마이그레이션 파일과 DB가 일치합니다.`);
    return 0;
  }

  console.error(`\n✗ ${projectRef}: DB에 없는 객체 ${total}개 — 미적용 마이그레이션이 있습니다.\n`);
  for (const [kind, label] of [['tables', '테이블'], ['functions', '함수'], ['types', 'ENUM']]) {
    for (const name of missing[kind]) {
      const from = expected.origin[`${kind.slice(0, -1)}:${name}`] || '?';
      console.error(`  ${label.padEnd(5)} ${name.padEnd(38)} ← ${from}`);
    }
  }
  console.error('\n적용: npx supabase db push  또는  대시보드 SQL Editor');
  return 1;
}

module.exports = {
  parseMigrations,
  diffSchema,
  stripSqlComments,
  readMigrations,
  fetchActualSchema,
};

if (require.main === module) {
  // ⚠️ process.exit()을 쓰지 않는다. 아직 닫히는 중인 소켓 핸들이 있으면
  //    Windows에서 libuv assert(UV_HANDLE_CLOSING)로 죽는다. 종료 코드만 세우고
  //    이벤트 루프가 비면 자연히 끝나게 둔다.
  main()
    .then((code) => { process.exitCode = code; })
    .catch((err) => {
      console.error('✗ 검사 실패:', err.message);
      process.exitCode = 2;
    });
}
