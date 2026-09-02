import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { updateUserRole, updateUserPassword, deleteUser, ROLES, MIN_PASSWORD_LEN, type Role } from "@/lib/db/users";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH — change a user's role and/or reset their password (admin only).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  let body: { role?: Role; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.role && !body.password) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 422 });
  }
  // Validate BOTH inputs up front so a bad password can never leave a role
  // change already committed (the two updates aren't a single transaction).
  if (body.password !== undefined && body.password.length < MIN_PASSWORD_LEN) {
    return NextResponse.json(
      { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
      { status: 422 }
    );
  }
  if (body.role !== undefined && !ROLES.includes(body.role)) {
    return NextResponse.json({ ok: false, error: "Unknown role." }, { status: 422 });
  }

  if (body.role) {
    const res = await updateUserRole(params.id, body.role);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 422 });
    await logAudit({ actor: auth.user.email, action: "admin.user.role", detail: `${res.user.email} → ${body.role}` });
  }
  if (body.password) {
    const res = await updateUserPassword(params.id, body.password);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 422 });
    await logAudit({ actor: auth.user.email, action: "admin.user.password", detail: res.user.email });
  }
  return NextResponse.json({ ok: true });
}

// DELETE — remove a user (admin only). Refuses to remove the last admin.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  const res = await deleteUser(params.id);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 422 });
  await logAudit({ actor: auth.user.email, action: "admin.user.delete", detail: res.user.email });
  return NextResponse.json({ ok: true });
}
