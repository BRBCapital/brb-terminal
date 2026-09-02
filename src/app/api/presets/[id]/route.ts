import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { deletePreset } from "@/lib/db/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const ok = await deletePreset(auth.user.email, params.id);
  if (!ok) return NextResponse.json({ ok: false, error: "Preset not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
