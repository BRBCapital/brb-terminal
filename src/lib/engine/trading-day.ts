// Trading-day arithmetic for the strategies engine. The core functions are PURE
// (they take a `holidays` Set of YYYY-MM-DD) so the scheduler logic is unit
// testable; `loadHolidays()` hydrates the set from the NGN Market API.

import { ngxFetch } from "@/lib/ngx/client";

// --- date-string arithmetic (anchored at UTC noon to dodge DST/rollover) ----
function ymdToDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
function dateToYmd(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}
export function addDays(s: string, n: number): string {
  const dt = ymdToDate(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dateToYmd(dt);
}
function weekdayOf(s: string): number {
  return ymdToDate(s).getUTCDay(); // 0 Sun … 6 Sat
}

export function isWeekend(s: string): boolean {
  const w = weekdayOf(s);
  return w === 0 || w === 6;
}

export function isTradingDay(s: string, holidays: Set<string>): boolean {
  return !isWeekend(s) && !holidays.has(s.slice(0, 10));
}

export function nextTradingDay(s: string, holidays: Set<string>): string {
  let d = addDays(s, 1);
  for (let i = 0; i < 40 && !isTradingDay(d, holidays); i++) d = addDays(d, 1);
  return d;
}

export function prevTradingDay(s: string, holidays: Set<string>): string {
  let d = addDays(s, -1);
  for (let i = 0; i < 40 && !isTradingDay(d, holidays); i++) d = addDays(d, -1);
  return d;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function firstWorkingDayOfMonth(year: number, month: number, holidays: Set<string>): string {
  let d = `${year}-${pad(month)}-01`;
  for (let i = 0; i < 15 && !isTradingDay(d, holidays); i++) d = addDays(d, 1);
  return d;
}

export function lastTradingDayOfMonth(year: number, month: number, holidays: Set<string>): string {
  // Day 0 of next month = last calendar day of this month.
  let d = dateToYmd(new Date(Date.UTC(year, month, 0, 12)));
  for (let i = 0; i < 15 && !isTradingDay(d, holidays); i++) d = addDays(d, -1);
  return d;
}

// Monday of the ISO-ish week containing `s` (weeks start Monday).
function mondayOf(s: string): string {
  const w = weekdayOf(s);
  const offset = w === 0 ? -6 : 1 - w; // Sun → back to prev Mon; else to this Mon
  return addDays(s, offset);
}

export function firstTradingDayOfWeek(s: string, holidays: Set<string>): string {
  let d = mondayOf(s);
  for (let i = 0; i < 7 && !isTradingDay(d, holidays); i++) d = addDays(d, 1);
  return d;
}

export function lastTradingDayOfWeek(s: string, holidays: Set<string>): string {
  let d = addDays(mondayOf(s), 4); // Friday
  for (let i = 0; i < 7 && !isTradingDay(d, holidays); i++) d = addDays(d, -1);
  return d;
}

export function isFirstTradingDayOfWeek(s: string, holidays: Set<string>): boolean {
  return isTradingDay(s, holidays) && firstTradingDayOfWeek(s, holidays) === s.slice(0, 10);
}

export function isLastTradingDayOfWeek(s: string, holidays: Set<string>): boolean {
  return isTradingDay(s, holidays) && lastTradingDayOfWeek(s, holidays) === s.slice(0, 10);
}

// Hydrate the holiday set from the NGN Market feed (24h-cached upstream).
export async function loadHolidays(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const res = await ngxFetch<{ holidays?: Array<{ date: string; name: string }> }>({
      path: "market/holidays",
    });
    if (res.ok && Array.isArray(res.data?.holidays)) {
      for (const h of res.data.holidays) if (h?.date) set.add(h.date.slice(0, 10));
    }
  } catch {
    // Non-fatal: fall back to weekend-only awareness.
  }
  return set;
}
