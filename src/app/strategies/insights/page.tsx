import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/auth/member";
import { InsightsClient } from "@/components/strategies/InsightsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Members area — Alternative Strategies" };

// Member-gated. The middleware leaves /strategies public, so this server
// component is the gate: no member session → send to the sign-in page.
export default async function InsightsPage() {
  const member = await getMember();
  if (!member) redirect("/strategies/login");
  return <InsightsClient member={member} />;
}
