// Database access. Talks to a networked Postgres (Neon in production) through a
// pooled connection, exposing the same `query()` / `queryOne()` the repository
// layer has always used — those 20-odd modules speak plain SQL and are
// unchanged by this backend swap.
//
// Why plain `pg` rather than Neon's WebSocket driver: it needs no WebSocket
// shim on Node 20, and it keeps this module portable — the identical build runs
// against Neon on Vercel, or RDS/self-hosted Postgres on EC2.

import "server-only";
import { createHash, randomBytes } from "crypto";
import { Pool, type PoolClient } from "pg";
import { SCHEMA_SQL } from "./schema";

// Vercel's Neon integration provisions several aliases. Prefer a POOLED URL:
// every serverless invocation is a separate client, so they must share
// PgBouncer rather than each holding a direct Postgres connection.
// (*_UNPOOLED / *_NON_POOLING are the direct ones.)
const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

// Advisory-lock key for schema init — an arbitrary but stable bigint, shared by
// every instance so only one runs DDL at a time.
const SCHEMA_LOCK_ID = 814_207_331;

// Fingerprint of the schema this build expects. Stored in `schema_state` after
// a successful migration so subsequent cold starts can skip the DDL entirely
// after ONE cheap SELECT, instead of re-running 69 CREATE/ALTER statements and
// a seed check every time a new serverless instance warms up. It changes
// automatically whenever schema.ts changes, so upgrades still migrate.
const SCHEMA_HASH = createHash("sha256").update(SCHEMA_SQL).digest("hex");

const STATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_state (
    id       integer PRIMARY KEY,
    sql_hash text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
`;

// Postgres: relation does not exist — i.e. a brand-new database.
const UNDEFINED_TABLE = "42P01";

async function schemaIsCurrent(pool: Pool): Promise<boolean> {
  try {
    const res = await pool.query<{ sql_hash: string }>(
      "SELECT sql_hash FROM schema_state WHERE id = 1"
    );
    return res.rows[0]?.sql_hash === SCHEMA_HASH;
  } catch (err) {
    if ((err as { code?: string }).code === UNDEFINED_TABLE) return false;
    throw err;
  }
}

interface DbHandle {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[] }>;
}

// Cache the pool + init across invocations. A warm serverless instance reuses
// both; a cold start pays for them once.
const g = globalThis as unknown as {
  __pgPool?: Pool;
  __pgInit?: Promise<void>;
};

function getPool(): Pool {
  if (!CONNECTION_STRING) {
    throw new Error(
      "No Postgres connection string. Set DATABASE_URL (or POSTGRES_URL) — " +
        "on Vercel these are provided by the Neon integration."
    );
  }
  if (!g.__pgPool) {
    // Neon presents a valid public certificate, so verify it rather than
    // disabling verification.
    const needsSsl =
      /sslmode=(require|verify-ca|verify-full)/.test(CONNECTION_STRING) ||
      /neon\.tech/.test(CONNECTION_STRING);
    g.__pgPool = new Pool({
      connectionString: CONNECTION_STRING,
      // One connection per serverless instance — PgBouncer does the real
      // pooling, so a burst of cold starts can't exhaust Postgres.
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
    });
    g.__pgPool.on("error", (err) => {
      // An idle-client error must not take the whole instance down.
      console.error("[db] idle client error", err);
    });
  }
  return g.__pgPool;
}

// Schema creation + first-boot seeding. Every statement in SCHEMA_SQL is
// already idempotent (CREATE TABLE/INDEX IF NOT EXISTS, ALTER … ADD COLUMN IF
// NOT EXISTS), but concurrent DDL from several cold-starting instances can
// still deadlock — so it runs in a transaction holding an advisory lock.
// pg_advisory_xact_lock (not the session variant) is deliberate: transaction-
// scoped locks are safe under PgBouncer transaction pooling, session ones are not.
async function initSchema(): Promise<void> {
  const pool = getPool();

  // Fast path: schema already matches this build, so there is nothing to do.
  // One indexed SELECT instead of 69 DDL statements per cold start.
  if (await schemaIsCurrent(pool)) return;

  const c: PoolClient = await pool.connect();
  let applied = false;
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK_ID]);

    // Double-checked locking: a concurrent cold start may have migrated while
    // we waited for the lock, so re-check now that we hold it.
    await c.query(STATE_TABLE_SQL);
    const cur = await c.query<{ sql_hash: string }>(
      "SELECT sql_hash FROM schema_state WHERE id = 1"
    );
    if (cur.rows[0]?.sql_hash !== SCHEMA_HASH) {
      await c.query(SCHEMA_SQL);
      await c.query(
        `INSERT INTO schema_state (id, sql_hash, applied_at) VALUES (1, $1, now())
         ON CONFLICT (id) DO UPDATE SET sql_hash = EXCLUDED.sql_hash, applied_at = now()`,
        [SCHEMA_HASH]
      );
      applied = true;
    }
    await c.query("COMMIT");
  } catch (err) {
    try {
      await c.query("ROLLBACK");
    } catch {
      /* connection already broken — nothing to roll back */
    }
    throw err;
  } finally {
    c.release();
  }

  // Only worth running right after a migration; on the fast path we never get
  // here. Both are idempotent, so a concurrent duplicate is harmless.
  if (!applied) return;

  const run = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => ({
    rows: (await pool.query(sql, params ?? [])).rows as T[],
  });

  // Seed staff accounts on first boot (no-op once users exist). Dynamic imports
  // avoid a static import cycle (users.ts depends on this module's query()).
  const { seedUsers } = await import("./users");
  await seedUsers((sql, params) => run(sql, params));
  // Encrypt any secrets stored before encryption-at-rest was added.
  const { encryptLegacySettings } = await import("./settings");
  await encryptLegacySettings(
    (sql, params) =>
      run(sql, params) as Promise<{ rows: { key: string; value: string }[] }>
  );
}

async function ready(): Promise<Pool> {
  if (!g.__pgInit) {
    g.__pgInit = initSchema().catch((err) => {
      // Don't cache a failed init — let the next request retry from scratch.
      g.__pgInit = undefined;
      throw err;
    });
  }
  await g.__pgInit;
  return getPool();
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = await ready();
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

// Collision-resistant, non-guessable id. Uses crypto randomness (not
// Math.random) so audit-log and record ids can't be predicted or collided —
// important for audit-trail integrity on a regulated desk.
export function newId(prefix: string): string {
  const t = Date.now().toString(36);
  const rand = randomBytes(9).toString("base64url");
  return `${prefix}_${t}${rand}`;
}

export type { DbHandle };
