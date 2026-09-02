import "server-only";
import { resolveKey, hasCredential } from "@/lib/settings/keys";

// Anthropic credential accessors used by the AI features. These delegate to the
// central managed-key registry (DB-first, env fallback, encrypted at rest).

export async function getAnthropicApiKey(): Promise<string | null> {
  return resolveKey("anthropic");
}

export async function hasAnthropicCredentials(): Promise<boolean> {
  return hasCredential("anthropic");
}
