"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { formatNaira, formatNairaCompact } from "@/lib/format";

// Colour a signed number the house way (positive forest, negative loss).
export function toneClass(n: number | null | undefined): string {
  if (n == null || n === 0) return "text-ink/60";
  return n > 0 ? "text-forest-soft" : "text-loss";
}

export function signedNaira(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = formatNaira(Math.abs(n));
  return n < 0 ? `−${s}` : n > 0 ? `+${s}` : s;
}

export function signedCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = formatNairaCompact(Math.abs(n));
  return n < 0 ? `−${s}` : n > 0 ? `+${s}` : s;
}

export function pct(n: number | null | undefined, dp = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = n.toFixed(dp);
  return n > 0 ? `+${v}%` : `${v}%`;
}

// A KPI stat card.
export function Stat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-4 py-3 shadow-card transition-colors">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className={clsx("mt-1.5 font-serif text-[22px] font-semibold leading-none tabular-nums text-forest", valueClass)}>
        {value}
      </p>
      {sub != null && <p className="mt-1.5 font-sans text-[10.5px] leading-tight text-ink/50">{sub}</p>}
    </div>
  );
}

// The headline metric — a rich, dark "primary card" for the book's net P&L.
export function HeroStat({
  label,
  value,
  valueClass,
  delta,
  sub,
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
  delta?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-forest-soft/50 bg-gradient-to-br from-forest to-forest-soft px-5 py-4 text-[#F5F2EC] shadow-card">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-fresh/10 blur-2xl" />
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-[#F5F2EC]/55">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className={clsx("font-serif text-[32px] font-bold leading-none tabular-nums", valueClass)}>{value}</p>
        {delta}
      </div>
      {sub != null && <p className="mt-2.5 font-sans text-[11px] text-[#F5F2EC]/70">{sub}</p>}
    </div>
  );
}

// A small up/down percentage chip that reads on light or dark surfaces.
export function DeltaChip({ pct }: { pct: number | null | undefined }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const up = pct >= 0;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold tabular-nums",
        up ? "bg-fresh/25 text-fresh" : "bg-loss/25 text-[#ff9e92]"
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// A small 0–100 factor score bar.
export function ScoreBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-stone">
        <span
          className="block h-full rounded-full bg-fresh"
          style={{ width: `${v}%` }}
        />
      </span>
      <span className="font-sans text-[10px] tabular-nums text-ink/55">{v}</span>
    </span>
  );
}

export function CadenceTag({ cadence }: { cadence: string }) {
  const tint: Record<string, string> = {
    intraday: "bg-fresh/20 text-forest",
    weekly: "bg-[#5FB0C9]/20 text-[#3d7f93] dark:text-[#8fcadb]",
    monthly: "bg-[#C9A227]/20 text-[#9a7c1e] dark:text-[#e0c774]",
  };
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-eyebrow ${
        tint[cadence] ?? "bg-stone text-ink/60"
      }`}
    >
      {cadence}
    </span>
  );
}
