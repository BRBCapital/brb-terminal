import Link from "next/link";
import { getSession, hasRole } from "@/lib/auth/session";
import { EngineReportClient } from "@/components/engine/EngineReportClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly performance report · BRB NGX Analyst" };

export default async function EngineReportPage({ params }: { params: { period: string } }) {
  const user = await getSession();
  if (!hasRole(user, "admin")) {
    return (
      <div className="brb-card p-8 text-center">
        <p className="font-serif text-lg text-forest">Admin access required</p>
        <Link href="/" className="mt-3 inline-block font-sans text-[13px] text-forest-soft underline">
          Back to the analyst dashboard
        </Link>
      </div>
    );
  }
  return <EngineReportClient period={params.period} />;
}
