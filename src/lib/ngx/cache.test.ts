import { describe, it, expect } from "vitest";
import { ttlForPath, isNgxOpen } from "./cache";

// WAT is UTC+1. Build a UTC instant that lands at a given WAT wall-clock time.
function watInstant(watHour: number, watMin: number, utcDay: number): Date {
  // 2026-07-13 is a Monday (UTC). Pick a base date on the desired weekday.
  // Weekday of the WAT wall clock is what isNgxOpen checks; for these times the
  // WAT and UTC weekday match (no midnight crossing), so set the UTC date's day.
  const base = new Date(Date.UTC(2026, 6, 6)); // 2026-07-06 = Monday
  base.setUTCDate(base.getUTCDate() + ((utcDay - 1 + 7) % 7)); // 1=Mon offset
  base.setUTCHours(watHour - 1, watMin, 0, 0); // WAT = UTC+1 → subtract 1h for UTC
  return base;
}

describe("isNgxOpen", () => {
  it("open during Mon–Fri 09:00–16:00 WAT", () => {
    expect(isNgxOpen(watInstant(12, 0, 1))).toBe(true); // Mon noon
    expect(isNgxOpen(watInstant(9, 0, 3))).toBe(true); // Wed 09:00 (inclusive)
    expect(isNgxOpen(watInstant(15, 59, 5))).toBe(true); // Fri 15:59
  });
  it("closed before/after hours and on weekends", () => {
    expect(isNgxOpen(watInstant(8, 30, 1))).toBe(false); // before open
    expect(isNgxOpen(watInstant(16, 0, 1))).toBe(false); // at close (exclusive)
    expect(isNgxOpen(watInstant(12, 0, 6))).toBe(false); // Saturday
    expect(isNgxOpen(watInstant(12, 0, 7))).toBe(false); // Sunday
  });
});

describe("ttlForPath — market-hours aware", () => {
  const open = watInstant(12, 0, 1); // Mon noon
  const closed = watInstant(20, 0, 1); // Mon 20:00

  it("live price group: short when open, long when closed", () => {
    expect(ttlForPath("market/snapshot", open)).toBe(2 * 60);
    expect(ttlForPath("market/snapshot", closed)).toBe(60 * 60);
    expect(ttlForPath("indices", open)).toBe(2 * 60);
    expect(ttlForPath("market/movers", closed)).toBe(60 * 60);
  });

  it("company detail: fresher when open, slow when closed", () => {
    expect(ttlForPath("companies/GTCO", open)).toBe(5 * 60);
    expect(ttlForPath("companies/GTCO", closed)).toBe(6 * 60 * 60);
  });

  it("company list carries prices — session-aware", () => {
    expect(ttlForPath("companies", open)).toBe(10 * 60);
    expect(ttlForPath("companies", closed)).toBe(60 * 60);
  });

  it("status flips feel responsive near the bell", () => {
    expect(ttlForPath("market/status", open)).toBe(60);
    expect(ttlForPath("market/status", closed)).toBe(30 * 60);
  });

  it("static/slow data is hard-cached regardless of session", () => {
    expect(ttlForPath("companies/GTCO/chart", open)).toBe(60 * 60);
    expect(ttlForPath("companies/identifiers", open)).toBe(24 * 60 * 60);
    expect(ttlForPath("market/holidays", closed)).toBe(24 * 60 * 60);
    expect(ttlForPath("companies/GTCO/financials", open)).toBe(12 * 60 * 60);
    expect(ttlForPath("forex/history", open)).toBe(6 * 60 * 60);
  });
});
