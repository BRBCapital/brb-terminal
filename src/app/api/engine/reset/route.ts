import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { resetLedger } from "@/lib/db/strategy";
import { getUserByEmail } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — wipe the engine ledger (trades, monthly profiles, run history). Keeps
// settings. Admin-only AND step-up authenticated: the caller must re-enter their
// own password, verified against the stored hash. Irreversible, audited.
export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch {
    /* handled below */
  }

  // Re-authenticate the acting admin against their stored credentials.
  const row = await getUserByEmail(auth.user.email);
  const ok = !!password && !!row && verifyPassword(password, row.password_hash, row.password_salt);
  if (!ok) {
    await logAudit({
      actor: auth.user.email,
      action: "engine.reset.denied",
      detail: "password re-auth failed",
    });
    return NextResponse.json(
      { ok: false, error: "Password incorrect — the ledger was not reset." },
      { status: 401 }
    );
  }

  const counts = await resetLedger();
  await logAudit({
    actor: auth.user.email,
    action: "engine.reset",
    detail: `cleared ${counts.trades} trades, ${counts.portfolios} portfolios, ${counts.runs} runs`,
  });
  return NextResponse.json({ ok: true, ...counts });
}
