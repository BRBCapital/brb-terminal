// Display formatters. Analysts want dense, unambiguous numbers — naira with
// thousands separators, compact market caps, signed percentages.

const NGN = "₦"; // ₦

export function formatNaira(
  value: number | null | undefined,
  opts: { decimals?: number } = {}
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const { decimals = 2 } = opts;
  return `${NGN}${value.toLocaleString("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// Compact large naira figures: ₦4.87T, ₦1.56B, ₦487.29M.
export function formatNairaCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const units: Array<[number, string]> = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      return `${sign}${NGN}${(abs / size).toFixed(2)}${suffix}`;
    }
  }
  return `${sign}${NGN}${abs.toFixed(2)}`;
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 0
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Intl.NumberFormat("en-NG", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

// Signed percentage: +0.84%, -9.80%.
export function formatPercent(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function changeTone(value: number | null | undefined): "up" | "down" | "flat" {
  if (value == null || Number.isNaN(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

// "as of 17 Apr 2026, 18:00 WAT" style — analysts must never mistake a delayed
// price for a live quote, so we surface the source timestamp verbatim.
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
    hour12: false,
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

// Relative freshness for the "cached N min ago" hint.
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}
