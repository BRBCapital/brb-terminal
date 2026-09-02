// Database access. Uses PGlite (Postgres compiled to WASM) with on-disk
// persistence for local/dev. To move to a networked Postgres in production,
// swap this module for a `pg`/`postgres` pool exposing the same `query()` — the
// repository layer speaks plain SQL and doesn't care which backend answers.

import "server-only";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { randomBytes } from "crypto";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA_SQL } from "./schema";

const DATA_DIR = process.env.PGLITE_DIR ?? ".data/pg";

interface DbHandle {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[] }>;
}

// Cache the instance + init across hot-reloads and requests.
const g = globalThis as unknown as { __pglite?: Promise<PGlite> };

async function getClient(): Promise<PGlite> {
  if (!g.__pglite) {
    g.__pglite = (async () => {
      // PGlite's own mkdir isn't recursive — ensure the parent path exists.
      mkdirSync(dirname(DATA_DIR), { recursive: true });
      const db = new PGlite(DATA_DIR);
      await db.waitReady;
      await db.exec(SCHEMA_SQL);
      // Seed staff accounts on first boot. Dynamic import avoids a static
      // import cycle (users.ts depends on this module's query()).
      const { seedUsers } = await import("./users");
      await seedUsers((sql, params) => db.query(sql, params ?? []));
      // Encrypt any secrets stored before encryption-at-rest was added.
      const { encryptLegacySettings } = await import("./settings");
      await encryptLegacySettings((sql, params) => db.query(sql, params ?? []) as Promise<{ rows: { key: string; value: string }[] }>);
      return db;
    })().catch((err) => {
      // Don't cache a failed init — let the next call retry from scratch.
      g.__pglite = undefined;
      throw err;
    });
  }
  return g.__pglite;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = await getClient();
  const res = await db.query<T>(sql, params);
  return res.rows;
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
