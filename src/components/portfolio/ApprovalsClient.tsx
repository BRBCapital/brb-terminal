"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { fetchProposalQueue, decideProposalReq } from "@/lib/portfolio/proposals-api";
import { Panel } from "@/components/ui/Tile";
import { formatNaira, formatNairaCompact, formatNumber, formatTimestamp } from "@/lib/format";
import type { ProposalTrade, RebalanceProposal } from "@/lib/db/proposals";

export function ApprovalsClient() {
  const [pending, setPending] = useState<RebalanceProposal[]>([]);
  const [recent, setRecent] = useState<RebalanceProposal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [p, all] = await Promise.all([
      fetchProposalQueue("pending"),
      fetchProposalQueue(),
    ]);
    setPending(p);
    setRecent(all.filter((x) => x.status !== "pending").slice(0, 10));
  }
  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    const note = decision === "rejected" ? window.prompt("Reason for rejection (optional):") ?? "" : "";
    await decideProposalReq(id, decision, note);
    setBusy(null);
    load();
  }

  function trades(p: RebalanceProposal): ProposalTrade[] {
    try {
      return JSON.parse(p.trades) as ProposalTrade[];
    } catch {
      return [];
    }
  }

  return (
    <div className="space-y-4">
      <div className="brb-callout flex items-start gap-2 rounded-r-lg bg-fresh/10 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-forest" />
        <p className="font-sans text-[12px] text-ink/70">
          Approving a proposal records a compliance decision — it does{" "}
          <strong>not</strong> execute any trade. Execution stays outside this tool.
        </p>
      </div>

      <Panel title="Pending approvals" subtitle={`${pending.length} awaiting decision`}>
        {pending.length === 0 ? (
          <p className="py-6 text-center font-sans text-[13px] text-ink/55">
            Nothing awaiting approval.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((p) => (
              <li key={p.id} className="rounded-lg border border-stone p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/portfolios/${p.portfolio_id}/manage`}
                      className="font-serif text-base font-semibold text-forest hover:underline"
                    >
                      {p.portfolio_name || "Portfolio"}
                    </Link>
                    <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                      By {p.created_by} · {formatTimestamp(p.created_at)} · turnover{" "}
                      {formatNairaCompact(p.turnover)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(p.id, "approved")}
                      disabled={busy === p.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-fresh px-3 py-1.5 font-sans text-[12px] font-semibold text-forest hover:brightness-95 disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => decide(p.id, "rejected")}
                      disabled={busy === p.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-loss/40 px-3 py-1.5 font-sans text-[12px] font-semibold text-loss hover:bg-loss/5 disabled:opacity-40"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {trades(p).map((t, i) => (
                    <span
                      key={i}
                      className={`rounded-md px-2 py-0.5 font-sans text-[11px] font-semibold ${
                        t.action === "BUY" ? "bg-fresh/15 text-forest-soft" : "bg-loss/10 text-loss"
                      }`}
                    >
                      {t.action} {formatNumber(t.units)} {t.symbol} · {formatNaira(t.value)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {recent.length > 0 && (
        <Panel title="Recent decisions" subtitle="Last 10">
          <ul className="divide-y divide-stone">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                {p.status === "approved" ? (
                  <CheckCircle2 className="h-4 w-4 text-fresh" />
                ) : (
                  <XCircle className="h-4 w-4 text-loss" />
                )}
                <div className="flex-1">
                  <p className="font-sans text-[13px] text-forest">
                    <span className="font-semibold capitalize">{p.status}</span> ·{" "}
                    {p.portfolio_name}
                  </p>
                  <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                    {p.decided_by} · {formatTimestamp(p.decided_at)}
                    {p.decision_note ? ` · "${p.decision_note}"` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
