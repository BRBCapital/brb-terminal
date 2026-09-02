"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { LayoutDashboard, Sparkles } from "lucide-react";
import { AiSummaryTab } from "./AiSummaryTab";

const TABS = [
  { key: "overview", label: "Market Overview", icon: LayoutDashboard },
  { key: "ai", label: "AI Daily Summary", icon: Sparkles },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// Client tab shell for the landing page. The overview content is passed in as
// server-rendered children so the existing dashboard tiles stay untouched.
export function DashboardTabs({ overview }: { overview: ReactNode }) {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-stone">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 font-sans text-[12px] font-semibold uppercase tracking-eyebrow transition-colors",
              tab === key
                ? "border-fresh text-forest"
                : "border-transparent text-ink/45 hover:text-forest"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Keep the overview mounted so its queries/state survive tab switches. */}
      <div className={tab === "overview" ? "" : "hidden"}>{overview}</div>
      {tab === "ai" && <AiSummaryTab />}
    </div>
  );
}
