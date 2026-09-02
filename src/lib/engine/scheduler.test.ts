import { describe, it, expect } from "vitest";
import { dueJobs } from "./scheduler";
import type { WatClock } from "./clock";

// 2026 reference: Aug 3 Mon (also first working day of month), Aug 10 Mon,
// Aug 12 Wed, Aug 14 Fri, Aug 31 Mon (last trading day of month), Aug 1 Sat.
const NONE = new Set<string>();

function clockFor(dateStr: string, minutes: number): WatClock {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return { dateStr, minutes, weekday, year, month, day };
}
const labels = (dateStr: string, minutes: number, hol = NONE) =>
  dueJobs(clockFor(dateStr, minutes), hol)
    .map((j) => `${j.action}_${j.cadence}`)
    .sort();

const M0930 = 9 * 60 + 30; // 570
const M1200 = 12 * 60; // 720
const M1600 = 16 * 60; // 960
const M0900 = 9 * 60; // 540

describe("dueJobs", () => {
  it("first working day of month that is also a Monday opens all three", () => {
    expect(labels("2026-08-03", M0930)).toEqual(["open_intraday", "open_monthly", "open_weekly"]);
  });

  it("a plain Monday opens intraday + weekly", () => {
    expect(labels("2026-08-10", M0930)).toEqual(["open_intraday", "open_weekly"]);
  });

  it("mid-week opens only intraday", () => {
    expect(labels("2026-08-12", M0930)).toEqual(["open_intraday"]);
    expect(labels("2026-08-12", M1200)).toEqual(["open_intraday"]); // still inside the open window
  });

  it("mid-week close closes only intraday", () => {
    expect(labels("2026-08-12", M1600)).toEqual(["close_intraday"]);
  });

  it("Friday close closes intraday + weekly", () => {
    expect(labels("2026-08-14", M1600)).toEqual(["close_intraday", "close_weekly"]);
  });

  it("last trading day of month close closes intraday + monthly", () => {
    expect(labels("2026-08-31", M1600)).toEqual(["close_intraday", "close_monthly"]);
  });

  it("nothing before the open window", () => {
    expect(labels("2026-08-12", M0900)).toEqual([]);
  });

  it("nothing on weekends", () => {
    expect(labels("2026-08-01", M1200)).toEqual([]); // Saturday
    expect(labels("2026-08-02", M1600)).toEqual([]); // Sunday
  });

  it("holidays shift the weekly boundary and skip the day entirely", () => {
    // Mon Aug 10 is a holiday → no jobs that day; Tue Aug 11 becomes first-of-week.
    expect(labels("2026-08-10", M0930, new Set(["2026-08-10"]))).toEqual([]);
    expect(labels("2026-08-11", M0930, new Set(["2026-08-10"]))).toEqual([
      "open_intraday",
      "open_weekly",
    ]);
  });
});
