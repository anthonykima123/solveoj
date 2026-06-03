// Postgres 영구 저장소.
// JSON DB 전체(_d)를 단일 JSONB 행에 통째로 저장한다.
// DATABASE_URL 환경변수가 있을 때만 사용된다 (없으면 로컬 파일 사용).
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Neon 등 관리형 Postgres는 SSL 필요
      max: 3
    });
  }
  return pool;
}

async function init() {
  await getPool().query(
    'CREATE TABLE IF NOT EXISTS judge_store (id INT PRIMARY KEY, data JSONB NOT NULL)'
  );
}

// 저장된 전체 DB 객체를 반환 (없으면 null)
async function load() {
  const r = await getPool().query('SELECT data FROM judge_store WHERE id = 1');
  return r.rows[0] ? r.rows[0].data : null;
}

// 전체 DB 객체를 통째로 저장 (upsert)
async function save(obj) {
  await getPool().query(
    `INSERT INTO judge_store (id, data) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET data = $1`,
    [JSON.stringify(obj)]
  );
}

module.exports = { init, load, save };
