"use client";

import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart } from "lucide-react";
import { useUser } from "@/components/auth/AuthProvider";

// Admin-only pill toggle between the analyst terminal and the strategies engine.
export function AppSwitcher() {
  const { user } = useUser();
  const pathname = usePathname();
  if (user?.role !== "admin") return null;

  const onEngine = pathname.startsWith("/engine");
  const pill = (active: boolean) =>
    clsx(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-sans text-[11px] font-semibold transition-colors",
      active ? "bg-fresh text-forest" : "text-[#F5F2EC]/65 hover:text-white"
    );

  return (
    <div className="hidden items-center rounded-full border border-[#F5F2EC]/15 bg-forest-soft/40 p-0.5 sm:flex">
      <Link href="/" className={pill(!onEngine)} aria-current={!onEngine ? "page" : undefined}>
        <LayoutDashboard className="h-3 w-3" /> Analyst
      </Link>
      <Link href="/engine" className={pill(onEngine)} aria-current={onEngine ? "page" : undefined}>
        <LineChart className="h-3 w-3" /> Engine
      </Link>
    </div>
  );
}
