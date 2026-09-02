import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting, setSetting, deleteSetting } from "@/lib/db/settings";
import { BASE_URL } from "@/lib/ngx/client";

// Central registry of managed API keys. Each provider knows its DB setting key,
// its environment fallback var, how to validate the format, and how to make a
// cheap live test call. Keys are stored encrypted (see db/crypto) and resolved
// DB-first so a key entered in the admin UI takes effect immediately.

export type ProviderId = "anthropic" | "ngnmarket";

export interface KeyTestResult {
  verified: boolean; // a live call succeeded
  authRejected: boolean; // the key was explicitly rejected (bad key)
  message?: string;
}

interface Provider {
  id: ProviderId;
  label: string;
  subtitle: string;
  settingKey: string;
  envVar: string;
  envAltVar?: string; // a gateway token that also counts as "configured"
  placeholder: string;
  docUrl: string;
  docLabel: string;
  formatHint: string;
  formatRegex: RegExp;
  test(key: string): Promise<KeyTestResult>;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: {
    id: "anthropic",
    label: "Claude API key",
    subtitle: "Powers the AI daily summary and filing extraction",
    settingKey: "anthropic_api_key",
    envVar: "ANTHROPIC_API_KEY",
    envAltVar: "ANTHROPIC_AUTH_TOKEN",
    placeholder: "sk-ant-…",
    docUrl: "https://console.anthropic.com/settings/keys",
    docLabel: "console.anthropic.com/settings/keys",
    formatHint: "expected to start with sk-ant-",
    formatRegex: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    async test(key) {
      try {
        const client = new Anthropic({ apiKey: key });
        await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4,
          messages: [{ role: "user", content: "ping" }],
        });
        return { verified: true, authRejected: false };
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) {
          return { verified: false, authRejected: true, message: "authentication failed" };
        }
        const msg = err instanceof Anthropic.APIError ? `HTTP ${err.status}` : "network error";
        return { verified: false, authRejected: false, message: msg };
      }
    },
  },
  ngnmarket: {
    id: "ngnmarket",
    label: "NGN Market API key",
    subtitle: "Powers all NGX market, company and pricing data",
    settingKey: "ngnmarket_api_key",
    envVar: "NGNMARKET_API_KEY",
    placeholder: "ngm_…",
    docUrl: "https://ngnmarket.com/dashboard",
    docLabel: "ngnmarket.com/dashboard",
    formatHint: "expected to start with ngm_",
    formatRegex: /^ngm_[A-Za-z0-9_-]{10,}$/,
    async test(key) {
      try {
        const res = await fetch(`${BASE_URL}/market/status`, {
          headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
          cache: "no-store",
        });
        const body = (await res.json().catch(() => null)) as
          | { success?: boolean; error?: { code?: string } }
          | null;
        if (res.ok && body?.success) return { verified: true, authRejected: false };
        const code = body?.error?.code;
        if (res.status === 401 || code === "INVALID_API_KEY" || code === "MISSING_API_KEY") {
          return { verified: false, authRejected: true, message: "key rejected" };
        }
        return { verified: false, authRejected: false, message: `HTTP ${res.status}` };
      } catch {
        return { verified: false, authRejected: false, message: "network error" };
      }
    },
  },
};

export function isProviderId(v: string): v is ProviderId {
  return v === "anthropic" || v === "ngnmarket";
}

// --- Resolution (DB-first, env fallback) with a short in-memory cache so the
// hot NGX path doesn't hit the DB on every request. Writes bust the cache. ---

const CACHE_TTL_MS = 15_000;
const cache = new Map<ProviderId, { value: string | null; at: number }>();
let now = () => Date.now();

export async function resolveKey(id: ProviderId): Promise<string | null> {
  const cached = cache.get(id);
  if (cached && now() - cached.at < CACHE_TTL_MS) return cached.value;
  const p = PROVIDERS[id];
  const stored = await getSetting(p.settingKey);
  const value = stored?.value || process.env[p.envVar] || null;
  cache.set(id, { value, at: now() });
  return value;
}

export function hasEnvCredential(id: ProviderId): boolean {
  const p = PROVIDERS[id];
  return Boolean(process.env[p.envVar] || (p.envAltVar && process.env[p.envAltVar]));
}

export async function hasCredential(id: ProviderId): Promise<boolean> {
  const key = await resolveKey(id);
  if (key) return true;
  const p = PROVIDERS[id];
  return Boolean(p.envAltVar && process.env[p.envAltVar]);
}

export type KeySource = "database" | "env" | null;

export interface KeyStatus {
  provider: ProviderId;
  label: string;
  subtitle: string;
  placeholder: string;
  docUrl: string;
  docLabel: string;
  configured: boolean;
  source: KeySource;
  masked: string | null;
  updatedBy?: string;
  updatedAt?: string;
}

export async function getKeyStatus(id: ProviderId): Promise<KeyStatus> {
  const p = PROVIDERS[id];
  const base = {
    provider: id,
    label: p.label,
    subtitle: p.subtitle,
    placeholder: p.placeholder,
    docUrl: p.docUrl,
    docLabel: p.docLabel,
  };
  const stored = await getSetting(p.settingKey);
  if (stored?.value) {
    return {
      ...base,
      configured: true,
      source: "database",
      masked: maskKey(stored.value),
      updatedBy: stored.updated_by,
      updatedAt: stored.updated_at,
    };
  }
  if (process.env[p.envVar]) {
    return { ...base, configured: true, source: "env", masked: maskKey(process.env[p.envVar]!) };
  }
  if (p.envAltVar && process.env[p.envAltVar]) {
    return { ...base, configured: true, source: "env", masked: "gateway token" };
  }
  return { ...base, configured: false, source: null, masked: null };
}

export function validateFormat(id: ProviderId, key: string): boolean {
  return PROVIDERS[id].formatRegex.test(key.trim());
}

export async function saveKey(id: ProviderId, key: string, actor: string): Promise<void> {
  await setSetting(PROVIDERS[id].settingKey, key.trim(), actor);
  cache.delete(id);
}

export async function clearKey(id: ProviderId): Promise<void> {
  await deleteSetting(PROVIDERS[id].settingKey);
  cache.delete(id);
}

function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 12) return `${k.slice(0, 4)}…`;
  return `${k.slice(0, 10)}…${k.slice(-4)}`;
}

// Test-only: allow deterministic time and cache reset in unit tests.
export const __test = {
  setNow: (fn: () => number) => {
    now = fn;
  },
  clearCache: () => cache.clear(),
};
