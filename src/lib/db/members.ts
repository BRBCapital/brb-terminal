import "server-only";
import { query, queryOne, newId } from "./client";
import { hashPassword, verifyPassword, newToken, hashApiKey } from "@/lib/auth/password";
import { isValidEmail, MIN_PASSWORD_LEN } from "./users";

// External prospect ("member") accounts for the public Alternative Strategies
// portal. Deliberately a SEPARATE identity system from the internal `users`
// table — a member can never authenticate into the internal app.

export interface Member {
  id: string;
  name: string;
  email: string;
  company: string;
  created_at: string;
  verified_at: string | null;
}

interface MemberRow extends Member {
  password_hash: string;
  password_salt: string;
}

type Result = { ok: true; member: Member; verifyToken: string } | { ok: false; error: string };

const PUBLIC_COLS = `id, name, email, company, created_at::text AS created_at, verified_at::text AS verified_at`;

export async function getMemberByEmail(email: string): Promise<MemberRow | null> {
  return queryOne<MemberRow>(
    `SELECT id, name, email, company, created_at::text AS created_at, verified_at::text AS verified_at, password_hash, password_salt
       FROM strategy_members WHERE lower(email) = lower($1)`,
    [email]
  );
}

export async function getMemberById(id: string): Promise<Member | null> {
  return queryOne<Member>(`SELECT ${PUBLIC_COLS} FROM strategy_members WHERE id = $1`, [id]);
}

// Self-service signup. Validates, enforces a unique email, hashes the password.
export async function createMember(input: {
  name: string;
  email: string;
  company: string;
  password: string;
}): Promise<Result> {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const company = (input.company ?? "").trim();
  const password = input.password ?? "";

  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (company.length < 2) return { ok: false, error: "Please enter your company." };
  if (password.length < MIN_PASSWORD_LEN) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
  }
  if (await getMemberByEmail(email)) {
    return { ok: false, error: "An account with that email already exists — try signing in." };
  }

  const id = newId("mbr");
  const { hash, salt } = hashPassword(password);
  const verifyToken = newToken();
  await query(
    `INSERT INTO strategy_members (id, name, email, company, password_hash, password_salt, verify_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, name, email, company, hash, salt, verifyToken]
  );
  return { ok: true, member: (await getMemberById(id))!, verifyToken };
}

// Verify credentials for login. Returns the public member on success.
export async function authenticateMember(email: string, password: string): Promise<Member | null> {
  const row = await getMemberByEmail(email);
  if (!row) {
    // Burn equivalent time to keep response time independent of account existence.
    verifyPassword(password, "a".repeat(128), "0".repeat(32));
    return null;
  }
  if (!verifyPassword(password, row.password_hash, row.password_salt)) return null;
  return { id: row.id, name: row.name, email: row.email, company: row.company, created_at: row.created_at, verified_at: row.verified_at };
}

// Email-verification: consume a token and mark the member verified.
export async function verifyMemberByToken(token: string): Promise<Member | null> {
  if (!token) return null;
  const r = await queryOne<Member>(
    `UPDATE strategy_members SET verified_at = now(), verify_token = NULL
      WHERE verify_token = $1
      RETURNING ${PUBLIC_COLS}`,
    [token]
  );
  return r ?? null;
}

// ---- member sessions -----------------------------------------------------

const SESSION_DAYS = 30;

export async function createMemberSession(memberId: string): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await query(`INSERT INTO strategy_member_sessions (token, member_id, expires_at) VALUES ($1,$2,$3)`, [
    hashApiKey(token),
    memberId,
    expires,
  ]);
  await query(`UPDATE strategy_members SET last_login_at = now() WHERE id = $1`, [memberId]);
  return token;
}

export async function getMemberBySession(token: string): Promise<Member | null> {
  return queryOne<Member>(
    `SELECT m.id, m.name, m.email, m.company, m.created_at::text AS created_at, m.verified_at::text AS verified_at
       FROM strategy_member_sessions s JOIN strategy_members m ON m.id = s.member_id
      WHERE s.token = $1 AND s.expires_at > now()`,
    [hashApiKey(token)]
  );
}

export async function deleteMemberSession(token: string): Promise<void> {
  await query(`DELETE FROM strategy_member_sessions WHERE token = $1`, [hashApiKey(token)]);
}

// ---- cached monthly theses ----------------------------------------------

export interface ThesisRow {
  period: string;
  content: string;
  model: string;
  generated_at: string;
}

export async function getThesis(period: string): Promise<ThesisRow | null> {
  return queryOne<ThesisRow>(
    `SELECT period, content, model, generated_at::text AS generated_at
       FROM strategy_theses WHERE period = $1`,
    [period]
  );
}

export async function saveThesis(period: string, content: string, model: string): Promise<void> {
  await query(
    `INSERT INTO strategy_theses (period, content, model, generated_at)
     VALUES ($1,$2,$3, now())
     ON CONFLICT (period) DO UPDATE SET content = EXCLUDED.content, model = EXCLUDED.model, generated_at = now()`,
    [period, content, model]
  );
}
