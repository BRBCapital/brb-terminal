import { SectionHeader } from "@/components/ui/SectionHeader";
import { AdminClient } from "@/components/admin/AdminClient";
import { getSession, hasRole } from "@/lib/auth/session";

export const metadata = { title: "Admin · BRB NGX Analyst" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSession();
  const isAdmin = hasRole(user, "admin");
  return (
    <div className="space-y-6">
      <SectionHeader number="06" eyebrow="Admin & Settings" title="Quota & Audit" />
      {isAdmin ? (
        <AdminClient />
      ) : (
        <div className="brb-card p-8 text-center">
          <p className="font-serif text-lg text-forest">Admin access required</p>
          <p className="mt-1 font-sans text-[13px] text-ink/55">
            The quota dashboard and audit trail are restricted to administrators.
          </p>
        </div>
      )}
    </div>
  );
}
