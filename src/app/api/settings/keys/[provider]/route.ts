import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import {
  PROVIDERS,
  isProviderId,
  getKeyStatus,
  validateFormat,
  saveKey,
  clearKey,
} from "@/lib/settings/keys";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET — masked status only (never the full key).
export async function GET(_req: NextRequest, { params }: { params: { provider: string } }) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  if (!isProviderId(params.provider)) {
    return NextResponse.json({ ok: false, error: "Unknown provider." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status: await getKeyStatus(params.provider) });
}

// PUT — save a new key. Validates format, does a best-effort live test, then
// persists it encrypted. The key is never echoed back.
export async function PUT(req: NextRequest, { params }: { params: { provider: string } }) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  if (!isProviderId(params.provider)) {
    return NextResponse.json({ ok: false, error: "Unknown provider." }, { status: 404 });
  }
  const provider = params.provider;
  const p = PROVIDERS[provider];

  let body: { apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const apiKey = (body.apiKey ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "An API key is required." }, { status: 422 });
  }
  if (!validateFormat(provider, apiKey)) {
    return NextResponse.json(
      { ok: false, error: `That does not look like a ${p.label} (${p.formatHint}).` },
      { status: 422 }
    );
  }

  // Live validation: a rejected key is a hard error (don't save). Any other
  // failure (offline, gateway, rate limit) still saves but is flagged untested.
  const result = await p.test(apiKey);
  if (result.authRejected) {
    return NextResponse.json(
      { ok: false, error: `The key was rejected by ${p.label.replace(/ API key$/, "")} (authentication failed).` },
      { status: 422 }
    );
  }

  await saveKey(provider, apiKey, auth.user.email);
  await logAudit({
    actor: auth.user.email,
    action: `settings.${provider}_key.set`,
    detail: result.verified ? "verified" : `unverified (${result.message ?? "no test"})`,
  });

  return NextResponse.json({
    ok: true,
    status: await getKeyStatus(provider),
    tested: result.verified,
    testError: result.verified
      ? undefined
      : `Saved, but the key could not be verified with a live call (${result.message ?? "unknown"}). It will be used as-is.`,
  });
}

// DELETE — remove the stored key (any environment fallback then applies).
export async function DELETE(_req: NextRequest, { params }: { params: { provider: string } }) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  if (!isProviderId(params.provider)) {
    return NextResponse.json({ ok: false, error: "Unknown provider." }, { status: 404 });
  }
  await clearKey(params.provider);
  await logAudit({ actor: auth.user.email, action: `settings.${params.provider}_key.clear`, detail: "" });
  return NextResponse.json({ ok: true, status: await getKeyStatus(params.provider) });
}
