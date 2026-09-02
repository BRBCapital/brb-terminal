import "server-only";
import { query, queryOne, newId } from "./client";
import { hashPassword, newToken, hashApiKey } from "@/lib/auth/password";

export type Role = "analyst" | "pm" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

interface UserRow extends User {
  password_hash: string;
  password_salt: string;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>(`SELECT * FROM users WHERE lower(email) = lower($1)`, [
    email,
  ]);
}

export async function getUserById(id: string): Promise<User | null> {
  return queryOne<User>(
    `SELECT id, email, name, role, created_at FROM users WHERE id = $1`,
    [id]
  );
}

export async function listUsers(): Promise<User[]> {
  return query<User>(
    `SELECT id, email, name, role, created_at FROM users ORDER BY role, name`
  );
}

export const ROLES: Role[] = ["analyst", "pm", "admin"];
export const MIN_PASSWORD_LEN = 8;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function countAdmins(): Promise<number> {
  const row = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`);
  return row?.n ?? 0;
}

type Result = { ok: true; user: User } | { ok: false; error: string };

// Admin-facing user creation. Validates input and enforces a unique email.
export async function adminCreateUser(input: {
  email: string;
  name: string;
  role: Role;
  password: string;
}): Promise<Result> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || email.split("@")[0];
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (!ROLES.includes(input.role)) return { ok: false, error: "Unknown role." };
  if (input.password.length < MIN_PASSWORD_LEN) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
  }
  if (await getUserByEmail(email)) return { ok: false, error: "A user with that email already exists." };

  const id = newId("usr");
  const { hash, salt } = hashPassword(input.password);
  await query(
    `INSERT INTO users (id, email, name, role, password_hash, password_salt)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, email, name, input.role, hash, salt]
  );
  return { ok: true, user: (await getUserById(id))! };
}

// Change a user's role. Refuses to demote the last remaining admin (lockout).
export async function updateUserRole(id: string, role: Role): Promise<Result> {
  if (!ROLES.includes(role)) return { ok: false, error: "Unknown role." };
  const target = await getUserById(id);
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "admin" && role !== "admin" && (await countAdmins()) <= 1) {
    return { ok: false, error: "Cannot demote the last administrator." };
  }
  await query(`UPDATE users SET role = $2 WHERE id = $1`, [id, role]);
  return { ok: true, user: (await getUserById(id))! };
}

export async function updateUserPassword(id: string, password: string): Promise<Result> {
  const target = await getUserById(id);
  if (!target) return { ok: false, error: "User not found." };
  if (password.length < MIN_PASSWORD_LEN) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
  }
  const { hash, salt } = hashPassword(password);
  await query(`UPDATE users SET password_hash = $2, password_salt = $3 WHERE id = $1`, [id, hash, salt]);
  // Revoke all existing sessions so a reset actually contains a compromise —
  // any stolen session token stops authenticating immediately.
  await query(`DELETE FROM sessions WHERE user_id = $1`, [id]);
  return { ok: true, user: target };
}

// Delete a user. Refuses to remove the last admin.
export async function deleteUser(id: string): Promise<Result> {
  const target = await getUserById(id);
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "admin" && (await countAdmins()) <= 1) {
    return { ok: false, error: "Cannot delete the last administrator." };
  }
  await query(`DELETE FROM sessions WHERE user_id = $1`, [id]);
  await query(`DELETE FROM users WHERE id = $1`, [id]);
  return { ok: true, user: target };
}

// Seed the three BRB staff roles on first boot. The analyst email matches the
// pre-auth default actor so portfolios created earlier stay owned by them.
//
// Runs DURING the db init promise, so it takes the raw query fn directly rather
// than going through the module-level query() (which would await the very init
// promise we're inside → deadlock).
type RawQuery = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

export async function seedUsers(raw: RawQuery): Promise<void> {
  const res = await raw(`SELECT count(*)::int AS n FROM users`);
  const n = (res.rows[0] as { n: number } | undefined)?.n ?? 0;
  if (n > 0) return;
  // Never seed a known default admin password in a live environment. Outside of
  // local dev, BRB_SEED_PASSWORD MUST be set explicitly — otherwise refuse to
  // create the default staff accounts (which include an admin) at all.
  const explicitPw = process.env.BRB_SEED_PASSWORD;
  const relaxedEnv = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  if (!explicitPw && !relaxedEnv) {
    throw new Error(
      "BRB_SEED_PASSWORD is not set. Refusing to seed default staff accounts (including an admin) with a known default password outside local development. Set a strong BRB_SEED_PASSWORD, and rotate the seeded passwords after first login."
    );
  }
  const pw = explicitPw ?? "brb-demo-pass";
  const seed = [
    { email: "analyst@brb.local", name: "Ana Analyst", role: "analyst" },
    { email: "pm@brb.local", name: "Paul Portfolio", role: "pm" },
    { email: "admin@brb.local", name: "Ada Admin", role: "admin" },
  ];
  for (const u of seed) {
    const { hash, salt } = hashPassword(pw);
    await raw(
      `INSERT INTO users (id, email, name, role, password_hash, password_salt)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [newId("usr"), u.email, u.name, u.role, hash, salt]
    );
  }
}

// ---- sessions ------------------------------------------------------------

const SESSION_DAYS = 7;

// Sessions store only the SHA-256 of the token (a bearer secret) — the raw
// token lives only in the httpOnly cookie. A DB/backup leak yields no usable
// sessions.
export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)`,
    [hashApiKey(token), userId, expires]
  );
  return token;
}

export async function getUserBySession(token: string): Promise<User | null> {
  return queryOne<User>(
    `SELECT u.id, u.email, u.name, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > now()`,
    [hashApiKey(token)]
  );
}

export async function deleteSession(token: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE token = $1`, [hashApiKey(token)]);
}
