import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// AES-256-GCM encryption for secrets stored in the database (API keys). The
// master key is derived from a server-side secret; ciphertext is authenticated
// (GCM tag) so tampering is detected on decrypt.
//
// Stored format:  enc:v1:<iv b64>:<tag b64>:<ciphertext b64>
// Values without the prefix are treated as legacy plaintext and returned as-is,
// so existing rows keep working and get re-encrypted on the next write.

const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  // Production MUST provide a dedicated secret. Falling back to the seed
  // password or a source-tree constant would let anyone with the data
  // directory recompute the key and decrypt every stored secret — a control
  // failure for a regulated desk, so we refuse rather than encrypt weakly.
  const explicit = process.env.APP_ENCRYPTION_KEY;
  // Only local development / tests may derive a fallback key. Any real
  // deployment (production, staging, …) must set APP_ENCRYPTION_KEY explicitly.
  const relaxedEnv = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  if (!explicit && !relaxedEnv) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Refusing to encrypt secrets under a derivable fallback key in production. Set a strong, stable APP_ENCRYPTION_KEY."
    );
  }
  // Dev/test convenience only: derive from the seed password or a constant.
  const secret = explicit || process.env.BRB_SEED_PASSWORD || "brb-local-dev-encryption-key";
  cachedKey = scryptSync(secret, "brb-settings-salt-v1", 32);
  return cachedKey;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

// Throws if the value is corrupt or was encrypted under a different master key.
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value; // legacy plaintext
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed ciphertext.");
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
