"use client";

import { Panel } from "@/components/ui/Tile";
import { formatTimestamp } from "@/lib/format";
import type { StrategyRun } from "@/lib/db/strategy";
import { signedNaira, toneClass } from "./ui";

const STATUS_TINT: Record<string, string> = {
  success: "bg-fresh/20 text-forest",
  skipped: "bg-stone text-ink/55",
  error: "bg-loss/15 text-loss",
  running: "bg-[#C9A227]/20 text-[#9a7c1e] dark:text-[#e0c774]",
};

export function RunsTab({ runs }: { runs: StrategyRun[] }) {
  return (
    <Panel title="Scheduler run log" subtitle="Every open/close job — scheduled and manual" right={<span className="font-sans text-[11px] text-ink/45">{runs.length}</span>}>
      {runs.length === 0 ? (
        <p className="py-6 text-center font-sans text-[12px] text-ink/45">
          No runs yet. Enable the engine, or use “Run now” in Settings.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left font-sans text-[12px]">
            <thead>
              <tr className="border-b border-stone text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-2 pr-2">Fired</th>
                <th className="pr-2">Job</th>
                <th className="px-2">Trigger</th>
                <th className="px-2">Status</th>
                <th className="px-2 text-right">Opened</th>
                <th className="px-2 text-right">Closed</th>
                <th className="px-2 text-right">P&L</th>
                <th className="pl-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-stone/60 align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap text-[11px] text-ink/55">{formatTimestamp(r.fired_at)}</td>
                  <td className="pr-2 font-mono text-[11px] text-forest">{r.kind}</td>
                  <td className="px-2 text-[11px] text-ink/55">{r.trigger}</td>
                  <td className="px-2">
                    <span className={`rounded-full px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-eyebrow ${STATUS_TINT[r.status] ?? "bg-stone"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-2 text-right tabular-nums">{r.trades_opened || "—"}</td>
                  <td className="px-2 text-right tabular-nums">{r.trades_closed || "—"}</td>
                  <td className={`px-2 text-right tabular-nums ${toneClass(r.pnl)}`}>{r.pnl ? signedNaira(r.pnl) : "—"}</td>
                  <td className="pl-2 text-[11px] text-ink/55">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
