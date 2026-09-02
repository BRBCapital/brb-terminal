"use client";

import { useState } from "react";
import clsx from "clsx";
import { FolderKanban, Sparkles, FlaskConical, Briefcase } from "lucide-react";
import { PortfolioList } from "./PortfolioList";
import { AiPortfolioBuilder } from "./AiPortfolioBuilder";
import { PaperTradingView } from "./PaperTradingView";
import { PaperPortfoliosView } from "./PaperPortfoliosView";

const TABS = [
  { key: "portfolios", label: "Model Portfolios", icon: FolderKanban },
  { key: "builder", label: "AI Builder", icon: Sparkles },
  { key: "paper", label: "Paper Trading", icon: FlaskConical },
  { key: "paperPortfolios", label: "Paper Trading Portfolio", icon: Briefcase },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function PortfoliosShell() {
  const [tab, setTab] = useState<Tab>("portfolios");
  // Bump to force the paper views to refetch when something is saved.
  const [paperKey, setPaperKey] = useState(0);
  const [paperPfKey, setPaperPfKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-stone">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 font-sans text-[12px] font-semibold uppercase tracking-eyebrow transition-colors",
                tab === t.key ? "border-fresh text-forest" : "border-transparent text-ink/45 hover:text-forest"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "portfolios" && <PortfolioList />}
      {tab === "builder" && (
        <AiPortfolioBuilder
          onPaperTradeSaved={() => setPaperKey((k) => k + 1)}
          onPaperPortfolioSaved={() => {
            setPaperPfKey((k) => k + 1);
            setTab("paperPortfolios");
          }}
        />
      )}
      {tab === "paper" && <PaperTradingView key={paperKey} />}
      {tab === "paperPortfolios" && <PaperPortfoliosView key={paperPfKey} />}
    </div>
  );
}
