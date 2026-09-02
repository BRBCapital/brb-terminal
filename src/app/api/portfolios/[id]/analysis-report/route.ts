import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import { enforce, HOUR } from "@/lib/rate-limit";
import { streamPortfolioReport } from "@/lib/ai/portfolio-report";
import type { ReviewSnapshot } from "@/lib/ai/portfolio-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // report generation can run well over a minute

// POST — generate a structured Portfolio Analysis Report, streamed as
// newline-delimited JSON (ChatEvent-style). Streaming keeps a long Fable 5
// document (~40-90s) from tripping request timeouts and lets the analyst watch
// it write. Owner/admin-guarded; auth/validation failures return plain JSON.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  const rl = enforce(`ai:analysis-report:${auth.user.email}`, 12, HOUR, "Please wait before generating another report.");
  if (rl) return rl;

  let body: { snapshot?: ReviewSnapshot };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.snapshot) {
    return NextResponse.json({ ok: false, error: "Missing snapshot." }, { status: 422 });
  }

  const snapshot = body.snapshot;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of streamPortfolioReport({ snapshot })) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", error: "Server error while writing the report.", errorCode: "API_ERROR" }) + "\n")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
