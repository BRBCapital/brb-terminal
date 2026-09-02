import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { listNotifications, unreadCount } from "@/lib/db/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const [notifications, unread] = await Promise.all([
    listNotifications(auth.user.email),
    unreadCount(auth.user.email),
  ]);
  return NextResponse.json({ ok: true, notifications, unread });
}
