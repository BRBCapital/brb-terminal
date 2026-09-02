"use client";

import clsx from "clsx";
import { useNgx } from "@/hooks/useNgx";
import type { MarketStatus } from "@/lib/ngx/types";

const REASON_LABEL: Record<MarketStatus["reason"], string> = {
  open: "Open for trading",
  weekend: "Closed — weekend",
  holiday: "Closed — public holiday",
  pre_market: "Pre-market",
  after_hours: "After hours — showing last close",
};

export function MarketStatusBanner() {
  // Status can flip; poll every 60s.
  const query = useNgx<MarketStatus>("market/status", {
    refetchInterval: 60_000,
  });

  const result = query.data;
  const data = result && result.ok ? result.data : null;
  const isOpen = data?.is_open ?? false;

  const detail = (() => {
    if (!data) return query.isLoading ? "Checking market status…" : "Status unavailable";
    if (data.is_open && data.closes_in) {
      return `${REASON_LABEL[data.reason]} · closes in ${data.closes_in.hours}h ${data.closes_in.minutes}m`;
    }
    if (!data.is_open) {
      const holiday = data.holiday ? ` (${data.holiday.name})` : "";
      const next = data.next_open ? ` · next open ${data.next_open.label}` : "";
      return `${REASON_LABEL[data.reason]}${holiday}${next}`;
    }
    return REASON_LABEL[data.reason];
  })();

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5",
        isOpen
          ? "border-fresh/50 bg-fresh/10"
          : "border-stone bg-stone/50"
      )}
    >
      <span className="relative flex h-2.5 w-2.5">
        {isOpen && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fresh opacity-70" />
        )}
        <span
          className={clsx(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            isOpen ? "bg-fresh" : "bg-ink/30"
          )}
        />
      </span>
      <span className="font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest">
        NGX {isOpen ? "Open" : "Closed"}
      </span>
      <span className="font-sans text-[12px] text-ink/60">{detail}</span>
      {data?.session && (
        <span className="ml-auto font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">
          {data.session.open_time}–{data.session.close_time} {data.session.timezone}
        </span>
      )}
    </div>
  );
}
