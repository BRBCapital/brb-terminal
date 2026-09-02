// WAT (Africa/Lagos, UTC+1, no DST) wall-clock helper for the scheduler.
// Uses Intl (DST-safe, host-timezone-independent) rather than a hardcoded +1h.

export interface WatClock {
  dateStr: string; // YYYY-MM-DD in WAT
  minutes: number; // minutes since midnight WAT (0..1439)
  weekday: number; // 0=Sun … 6=Sat (WAT)
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

// NGX regular session: 09:00–16:00 WAT. The engine opens 30 min after the bell.
export const OPEN_MIN = 9 * 60; // 540 — 09:00
export const OPEN_PLUS_30 = 9 * 60 + 30; // 570 — 09:30
export const CLOSE_MIN = 16 * 60; // 960 — 16:00

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function watClock(now: Date = new Date()): WatClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some ICU builds emit 24 at midnight
  const minute = Number(get("minute"));
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
    weekday: WD[get("weekday")] ?? new Date(year, month - 1, day).getDay(),
    year,
    month,
    day,
  };
}
