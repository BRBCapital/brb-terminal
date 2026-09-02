import { NextRequest } from "next/server";
import { getMember } from "@/lib/auth/member";
import { getThesis, saveThesis } from "@/lib/db/members";
import { getPeriodOverview } from "@/lib/engine/period";
import { streamStrategyThesis } from "@/lib/ai/strategy-thesis";
import { enforce, HOUR } from "@/lib/rate-limit";

const INCEPTION_PERIOD = "2026-01"; // no theses before the programme existed

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function periodLabel(period: string) {
  const [y, m] = period.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// MEMBER-GATED — streams (NDJSON) the non-proprietary monthly "Strategist's
// Thesis". Cached per period: the first authenticated viewer triggers a
// generation; everyone after gets the stored narrative instantly.
export async function GET(req: NextRequest) {
  const member = await getMember();
  if (!member) return json({ ok: false, error: "Sign in to read the thesis." }, 401);
  if (!member.verified_at) {
    return json({ ok: false, error: "Verify your email to unlock the monthly thesis — check your inbox for the verification link." }, 403);
  }

  const period = new URL(req.url).searchParams.get("period") ?? "";
  if (!/^\d{4}-\d{2}$/.test(period)) return json({ ok: false, error: "Invalid period." }, 400);

  // Bound the period to the programme window (inception..current month) so the
  // AI generation can't be forced across thousands of distinct periods.
  const now = new Date();
  const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (period < INCEPTION_PERIOD || period > currentPeriod) {
    return json({ ok: false, error: "Period is outside the available range." }, 400);
  }

  // Defense-in-depth for this GET side effect: reject cross-origin callers.
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return json({ ok: false, error: "Cross-origin request rejected." }, 403);
  }

  // Cap generation volume per member (bounds AI spend).
  const limited = enforce(`insight:${member.id}`, 20, HOUR, "You're requesting insights too quickly — please wait a moment.");
  if (limited) return limited;

  const cached = await getThesis(period);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        if (cached) {
          send({ type: "delta", text: cached.content });
          send({ type: "done", model: cached.model, cached: true });
          controller.close();
          return;
        }

        // Derive a coarse, NON-proprietary context (activity + posture direction
        // only — no figures leave this function).
        let active = false;
        let posture: "constructive" | "flat" | "defensive" = "flat";
        try {
          const ov = await getPeriodOverview(period);
          active = ov.trade_count > 0;
          const r = ov.overview.totals.return_pct;
          posture = r > 0.3 ? "constructive" : r < -0.3 ? "defensive" : "flat";
        } catch {
          /* fall back to neutral context */
        }

        let buf = "";
        let model = "";
        for await (const ev of streamStrategyThesis({ label: periodLabel(period), active, posture })) {
          if (ev.type === "delta") {
            buf += ev.text;
            send(ev);
          } else if (ev.type === "done") {
            model = ev.model;
            send(ev);
          } else {
            send(ev);
          }
        }
        if (buf.trim()) await saveThesis(period, buf, model);
        controller.close();
      } catch {
        send({ type: "error", error: "Could not generate the thesis — please try again.", errorCode: "API_ERROR" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
