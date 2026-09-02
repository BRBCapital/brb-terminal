import "server-only";
import { scryptSync, randomBytes, timingSafeEqual, createHash } from "crypto";

// scrypt password hashing using Node's built-in crypto — no native dependency
// (bcrypt/argon2 would need a compile step this environment can't run).

const KEYLEN = 64;

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return { hash, salt };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string
): boolean {
  const candidate = scryptSync(password, salt, KEYLEN);
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== candidate.length) return false;
  return timingSafeEqual(stored, candidate);
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

// Deterministic hash of an API key, for O(1) lookup on authentication. The full
// key is never stored in the clear for auth — only this hash (plus a separately
// encrypted copy for the owner to re-reveal).
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
