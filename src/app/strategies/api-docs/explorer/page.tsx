import type { Metadata } from "next";
import { SwaggerExplorer } from "@/components/strategies/SwaggerExplorer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "API explorer — Alternative Strategies" };

// Public — interactive Swagger UI for the broker API, reading /api/v1/openapi.json.
export default function ApiExplorerPage() {
  return <SwaggerExplorer />;
}
