import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { listUsers, adminCreateUser, type Role } from "@/lib/db/users";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — list all users (admin only).
export async function GET() {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, users: await listUsers() });
}

// POST — create a user (admin only). Password is never echoed back.
export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  let body: { email?: string; name?: string; role?: Role; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.email || !body.password || !body.role) {
    return NextResponse.json({ ok: false, error: "email, password and role are required." }, { status: 422 });
  }

  const result = await adminCreateUser({
    email: body.email,
    name: body.name ?? "",
    role: body.role,
    password: body.password,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  await logAudit({
    actor: auth.user.email,
    action: "admin.user.create",
    detail: `${result.user.email} (${result.user.role})`,
  });
  return NextResponse.json({ ok: true, user: result.user });
}
