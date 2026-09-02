"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/Tile";
import { formatNaira, formatNumber } from "@/lib/format";
import type { OverviewPosition } from "@/lib/engine/overview";
import { toneClass, signedNaira, pct, CadenceTag } from "./ui";

function Row({ p, closed }: { p: OverviewPosition; closed?: boolean }) {
  return (
    <tr className="border-b border-stone/60">
      <td className="py-2 pr-2">
        <Link href={`/stocks/${p.symbol}`} className="font-sans text-[11px] font-bold uppercase tracking-wide text-forest hover:underline">
          {p.symbol}
        </Link>
        <div className="font-sans text-[10px] text-ink/45">{p.sector}</div>
      </td>
      <td className="px-2"><CadenceTag cadence={p.cadence} /></td>
      <td className="px-2 text-right tabular-nums">{formatNumber(p.shares)}</td>
      <td className="px-2 text-right tabular-nums">{formatNaira(p.entry_price)}</td>
      <td className="px-2 text-right tabular-nums">{p.current_price == null ? "—" : formatNaira(p.current_price)}</td>
      <td className="px-2 text-right tabular-nums">{formatNaira(p.amount_ngn)}</td>
      <td className={`px-2 text-right tabular-nums ${toneClass(p.unrealized)}`}>{signedNaira(p.unrealized)}</td>
      <td className={`pl-2 text-right tabular-nums ${toneClass(p.unrealized_pct)}`}>{pct(p.unrealized_pct)}</td>
    </tr>
  );
}

function Table({ rows, closed }: { rows: OverviewPosition[]; closed?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left font-sans text-[12px]">
        <thead>
          <tr className="border-b border-stone text-[10px] uppercase tracking-eyebrow text-ink/45">
            <th className="py-2 pr-2">Stock</th>
            <th className="px-2">Cadence</th>
            <th className="px-2 text-right">Shares</th>
            <th className="px-2 text-right">Entry</th>
            <th className="px-2 text-right">{closed ? "Close" : "Live"}</th>
            <th className="px-2 text-right">Value</th>
            <th className="px-2 text-right">{closed ? "Realised" : "Unrealised"}</th>
            <th className="pl-2 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <Row key={p.id} p={p} closed={closed} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PositionsTab({ open, closed }: { open: OverviewPosition[]; closed: OverviewPosition[] }) {
  return (
    <div className="space-y-4">
      <Panel title="Open positions" subtitle="Live mark-to-market" right={<span className="font-sans text-[11px] text-ink/45">{open.length}</span>}>
        {open.length ? <Table rows={open} /> : <p className="py-6 text-center font-sans text-[12px] text-ink/45">No open positions.</p>}
      </Panel>
      <Panel title="Closed trades" subtitle="Realised history (latest 40)" right={<span className="font-sans text-[11px] text-ink/45">{closed.length}</span>}>
        {closed.length ? <Table rows={closed} closed /> : <p className="py-6 text-center font-sans text-[12px] text-ink/45">No closed trades yet.</p>}
      </Panel>
    </div>
  );
}
