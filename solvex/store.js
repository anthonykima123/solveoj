const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');

function createStore(connectionString) {
  if (!connectionString) return null;
  const pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 4000, statement_timeout: 5000 });
  pool.on('error', () => console.error(JSON.stringify({ event: 'solvex_db_connection' })));
  const init = () => pool.query(`
    CREATE TABLE IF NOT EXISTS solvex_reviews (
      id uuid PRIMARY KEY, user_id text NOT NULL, kind text NOT NULL,
      fingerprint text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      report jsonb, outcome text NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS solvex_reviews_created_idx ON solvex_reviews (created_at);
    CREATE INDEX IF NOT EXISTS solvex_reviews_owner_idx ON solvex_reviews (user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS solvex_controls (id boolean PRIMARY KEY, paused boolean NOT NULL);
    CREATE TABLE IF NOT EXISTS solvex_problem_hints (
      problem_id bigint PRIMARY KEY, fingerprint text NOT NULL, claim uuid NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(), hint text
    );
  `);
  return {
    init, close: () => pool.end(), ping: () => pool.query('SELECT 1'),
    async getHint(problem, fingerprint) {
      const { rows: [entry] } = await pool.query('SELECT hint FROM solvex_problem_hints WHERE problem_id=$1 AND fingerprint=$2', [problem, fingerprint]);
      return entry?.hint;
    },
    async claimHint(problem, fingerprint) {
      const claim = randomUUID();
      const result = await pool.query(`
        INSERT INTO solvex_problem_hints (problem_id, fingerprint, claim) VALUES ($1,$2,$3)
        ON CONFLICT (problem_id) DO UPDATE SET fingerprint=$2, claim=$3, updated_at=now(), hint=NULL
        WHERE solvex_problem_hints.fingerprint <> $2 OR
          (solvex_problem_hints.hint IS NULL AND solvex_problem_hints.updated_at < now() - interval '90 seconds')
      `, [problem, fingerprint, claim]);
      return result.rowCount ? claim : null;
    },
    saveHint: (id, claim, hint) => pool.query(
      'UPDATE solvex_problem_hints SET hint=$3,updated_at=now() WHERE problem_id=$1 AND claim=$2', [id, claim, hint]
    ),
    async reserve(user, kind, fingerprint, limits) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(517588201)');
        const { rows: [usage] } = await client.query(`
          SELECT (SELECT paused FROM solvex_controls WHERE id = true) AS paused,
            count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')::int AS daily,
            count(*) FILTER (WHERE user_id = $1 AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')::int AS personal,
            count(*) FILTER (WHERE created_at > now() - interval '1 minute')::int AS minute,
            count(*) FILTER (WHERE outcome = 'pending' AND created_at > now() - interval '45 seconds')::int AS running,
            bool_or(outcome = 'provider_quota' AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul') AS quota,
            bool_or(user_id = $1 AND fingerprint = $2 AND created_at > now() - interval '1 minute') AS duplicate
          FROM solvex_reviews WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
            OR created_at > now() - interval '1 minute'
        `, [user, fingerprint]);
        let reason;
        if (usage.paused) reason = 'paused';
        else if (usage.quota) reason = 'provider_quota';
        else if (usage.duplicate) reason = 'duplicate';
        else if (usage.daily >= limits.daily || usage.personal >= limits.personal ||
                 usage.minute >= limits.minute || usage.running >= limits.running) reason = 'limit';
        const id = randomUUID();
        if (!reason) await client.query('INSERT INTO solvex_reviews (id,user_id,kind,fingerprint) VALUES ($1,$2,$3,$4)', [id, user, kind, fingerprint]);
        await client.query('COMMIT');
        return reason ? { reason } : { id };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    finish: (id, outcome) => pool.query('UPDATE solvex_reviews SET outcome=$2 WHERE id=$1', [id, outcome]),
    save: (id, report) => pool.query("UPDATE solvex_reviews SET outcome='success', report=$2 WHERE id=$1", [id, report]),
    async history(user) {
      const { rows } = await pool.query('SELECT id, kind, created_at FROM solvex_reviews WHERE user_id=$1 AND report IS NOT NULL ORDER BY created_at DESC LIMIT 50', [user]);
      return rows;
    },
    async get(user, id) {
      const { rows: [review] } = await pool.query('SELECT kind, report FROM solvex_reviews WHERE user_id=$1 AND id=$2 AND report IS NOT NULL', [user, id]);
      return review;
    },
    remove: (user, id) => pool.query('UPDATE solvex_reviews SET report=NULL WHERE user_id=$1 AND id=$2', [user, id]),
    pause: paused => pool.query('INSERT INTO solvex_controls (id,paused) VALUES (true,$1) ON CONFLICT (id) DO UPDATE SET paused=$1', [paused]),
    async stats() {
      const { rows: [stats] } = await pool.query(`
        SELECT count(*)::int AS total, count(*) FILTER (WHERE outcome='success')::int AS success,
          count(*) FILTER (WHERE outcome NOT IN ('success','pending'))::int AS failed,
          coalesce((SELECT paused FROM solvex_controls WHERE id=true), false) AS paused
        FROM solvex_reviews WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
      `);
      return stats;
    }
  };
}

module.exports = { createStore };
