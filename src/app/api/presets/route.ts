import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { createPreset, listPresets } from "@/lib/db/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const presets = await listPresets(auth.user.email);
  return NextResponse.json({ ok: true, presets });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let body: { name?: string; config?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "Preset needs a name." }, { status: 422 });
  }
  const preset = await createPreset(auth.user.email, body.name.trim(), body.config);
  return NextResponse.json({ ok: true, preset }, { status: 201 });
}
