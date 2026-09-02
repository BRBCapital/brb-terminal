import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { evaluateAlerts, unreadCount } from "@/lib/db/notifications";
import { evaluatePriceAlerts } from "@/lib/db/price-alerts";
import { enforce, MIN } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual "check now" — runs the same evaluation the worker runs on its interval.
// This kicks off global alert evaluation, so throttle it per user to prevent
// resource-amplification abuse.
export async function POST() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = enforce(`notif-eval:${auth.user.email}`, 6, MIN);
  if (limited) return limited;
  const [portfolioN, priceN] = await Promise.all([evaluateAlerts(), evaluatePriceAlerts()]);
  const unread = await unreadCount(auth.user.email);
  return NextResponse.json({ ok: true, created: portfolioN + priceN, unread });
}
