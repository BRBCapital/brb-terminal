import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import { enforce, HOUR } from "@/lib/rate-limit";
import { streamChatPortfolio, type ChatMessage } from "@/lib/ai/portfolio-chat";
import type { ReviewSnapshot } from "@/lib/ai/portfolio-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — one turn of the portfolio "Ask Fable" chat, streamed. The client sends
// the same snapshot it renders plus the conversation so far; Fable answers
// grounded in it, streaming its reply and calling get_stock_fundamentals for any
// single-name deep-dives. Response is newline-delimited JSON (NDJSON) of
// ChatEvent objects; auth/validation failures come back as plain JSON instead.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  const rl = enforce(`ai:chat:${auth.user.email}`, 40, HOUR, "You're sending messages too quickly — please wait a moment.");
  if (rl) return rl;

  let body: { snapshot?: ReviewSnapshot; messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.snapshot || !Array.isArray(body.messages)) {
    return NextResponse.json({ ok: false, error: "Missing snapshot or messages." }, { status: 422 });
  }

  const snapshot = body.snapshot;
  const messages = body.messages;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of streamChatPortfolio({ snapshot, messages })) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", error: "Server error while answering.", errorCode: "API_ERROR" }) + "\n")
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
      "X-Accel-Buffering": "no", // don't let a proxy buffer the stream
    },
  });
}
