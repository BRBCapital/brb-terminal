import { SectionHeader } from "@/components/ui/SectionHeader";
import { ApprovalsClient } from "@/components/portfolio/ApprovalsClient";
import { getSession, hasRole } from "@/lib/auth/session";

export const metadata = { title: "Approvals · BRB NGX Analyst" };
export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await getSession();
  const canApprove = hasRole(user, "pm");
  return (
    <div className="space-y-6">
      <SectionHeader number="08" eyebrow="Rebalancing" title="PM Approvals" />
      {canApprove ? (
        <ApprovalsClient />
      ) : (
        <div className="brb-card p-8 text-center">
          <p className="font-serif text-lg text-forest">Principal Fund Manager access required</p>
          <p className="mt-1 font-sans text-[13px] text-ink/55">
            Only Principal Fund Managers and Admins can review rebalancing approvals.
          </p>
        </div>
      )}
    </div>
  );
}
