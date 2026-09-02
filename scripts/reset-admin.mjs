// One-off admin/user password tool. Resets an existing user's password, or
// creates the user if they don't exist. You supply the value at runtime via an
// env var — it is scrypt-hashed (identical to src/lib/auth/password.ts) and
// never printed or persisted in the clear.
//
// USAGE (stop the app first — PGlite locks its data directory to one process):
//
//   RESET_EMAIL=bassey@brbcapital.co.uk RESET_PASSWORD='********' \
//   RESET_ROLE=admin RESET_NAME='Bassey' npm run reset-admin
//
// Env:
//   RESET_EMAIL     (required) the account's email
//   RESET_PASSWORD  (required) new password, min 8 chars
//   RESET_ROLE      (optional) analyst | pm | admin — set on create, or to
//                   change an existing user's role. Defaults to admin on create.
//   RESET_NAME      (optional) display name when creating a new user
//   PGLITE_DIR      (optional) DB directory (defaults to .data/pg, same as app)

import { PGlite } from "@electric-sql/pglite";
import { scryptSync, randomBytes } from "node:crypto";

const KEYLEN = 64; // must match src/lib/auth/password.ts
const MIN_PASSWORD_LEN = 8;
const ROLES = ["analyst", "pm", "admin"];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return { hash, salt };
}

function newId(prefix) {
  const t = Date.now().toString(36);
  const rand = randomBytes(9).toString("base64url");
  return `${prefix}_${t}${rand}`;
}

const email = (process.env.RESET_EMAIL ?? "").trim().toLowerCase();
const password = process.env.RESET_PASSWORD ?? "";
const role = (process.env.RESET_ROLE ?? "").trim();
const name = (process.env.RESET_NAME ?? "").trim();
const dir = process.env.PGLITE_DIR ?? ".data/pg";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!email) fail("RESET_EMAIL is required.");
if (!password) fail("RESET_PASSWORD is required.");
if (password.length < MIN_PASSWORD_LEN) fail(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
if (role && !ROLES.includes(role)) fail(`RESET_ROLE must be one of: ${ROLES.join(", ")}.`);

let db;
try {
  db = new PGlite(dir);
  await db.waitReady;
} catch (err) {
  fail(
    `Could not open the database at "${dir}". Is the app still running? ` +
      `Stop it first (PGlite allows one process at a time).\n  ${err?.message ?? err}`
  );
}

const { rows } = await db.query("SELECT id, role FROM users WHERE lower(email) = $1", [email]);
const existing = rows[0];
const { hash, salt } = hashPassword(password);

if (existing) {
  await db.query("UPDATE users SET password_hash = $2, password_salt = $3 WHERE id = $1", [
    existing.id,
    hash,
    salt,
  ]);
  if (role && role !== existing.role) {
    await db.query("UPDATE users SET role = $2 WHERE id = $1", [existing.id, role]);
    console.log(`✓ Password reset and role changed to '${role}' for ${email}.`);
  } else {
    console.log(`✓ Password reset for ${email} (role: ${existing.role}).`);
  }
} else {
  const finalRole = role || "admin";
  await db.query(
    `INSERT INTO users (id, email, name, role, password_hash, password_salt)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [newId("usr"), email, name || email.split("@")[0], finalRole, hash, salt]
  );
  console.log(`✓ Created new ${finalRole} user ${email}.`);
}

await db.close();
console.log("  You can now sign in with the password you provided.");
