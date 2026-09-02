import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/session";
import { EngineClient } from "@/components/engine/EngineClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Strategies Engine · BRB NGX Analyst" };

export default async function EnginePage() {
  const user = await getSession();
  if (!hasRole(user, "admin")) {
    return (
      <div className="brb-card p-8 text-center">
        <p className="font-serif text-lg text-forest">Admin access required</p>
        <p className="mx-auto mt-1 max-w-md font-sans text-[13px] text-ink/55">
          The Alternative Strategies Engine is restricted to administrators.
        </p>
        <Link href="/" className="mt-3 inline-block font-sans text-[13px] text-forest-soft underline">
          Back to the analyst dashboard
        </Link>
      </div>
    );
  }
  return <EngineClient />;
}
