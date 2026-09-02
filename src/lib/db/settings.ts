import "server-only";
import { query, queryOne } from "./client";
import { encryptSecret, decryptSecret, isEncrypted } from "./crypto";

// Server-side key/value store for platform settings. Values are secrets
// (e.g. API keys), encrypted at rest with AES-256-GCM and never returned to
// the client in full.

export interface AppSetting {
  key: string;
  value: string; // decrypted plaintext (in-memory only)
  updated_by: string;
  updated_at: string;
}

export async function getSetting(key: string): Promise<AppSetting | null> {
  const row = await queryOne<AppSetting>(`SELECT * FROM app_settings WHERE key = $1`, [key]);
  if (!row) return null;
  try {
    return { ...row, value: decryptSecret(row.value) };
  } catch {
    // Unreadable (corrupt, or encrypted under a rotated master key) — treat as
    // absent so the UI shows "not configured" rather than leaking ciphertext.
    console.warn(`[settings] could not decrypt "${key}"; treating as unset.`);
    return null;
  }
}

export async function setSetting(key: string, value: string, updatedBy: string): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_by)
     VALUES ($1,$2,$3)
     ON CONFLICT (key)
     DO UPDATE SET value = $2, updated_by = $3, updated_at = now()`,
    [key, encryptSecret(value), updatedBy]
  );
}

export async function deleteSetting(key: string): Promise<void> {
  await query(`DELETE FROM app_settings WHERE key = $1`, [key]);
}

// One-time migration: encrypt any settings that were stored as plaintext before
// encryption-at-rest was introduced. Idempotent — skips already-encrypted rows.
// Runs against the raw db handle at boot (before query() caching matters).
export async function encryptLegacySettings(
  exec: (sql: string, params?: unknown[]) => Promise<{ rows: { key: string; value: string }[] }>
): Promise<number> {
  const res = await exec(`SELECT key, value FROM app_settings`);
  let migrated = 0;
  for (const row of res.rows) {
    if (isEncrypted(row.value)) continue;
    await exec(`UPDATE app_settings SET value = $2 WHERE key = $1`, [row.key, encryptSecret(row.value)]);
    migrated++;
  }
  return migrated;
}
