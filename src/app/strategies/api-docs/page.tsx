import type { Metadata } from "next";
import { ApiDocs } from "@/components/strategies/ApiDocs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "API documentation — Alternative Strategies",
  description: "Integrate the Alternative Strategies engine: pull AI trade signals scaled to your AUM, track allocated transactions, and report executions.",
};

// Public — linked from the landing page. The integration reference for brokers.
export default function ApiDocsPage() {
  return <ApiDocs />;
}
