import { NextRequest, NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/broker-openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/openapi.json — the OpenAPI 3.1 spec for the broker API. Public
// (specs carry no secrets); import the URL directly into Postman / Swagger UI.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json(buildOpenApiSpec(origin), {
    headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });
}
