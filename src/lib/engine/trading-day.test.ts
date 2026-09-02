import { describe, it, expect } from "vitest";
import {
  isWeekend,
  isTradingDay,
  nextTradingDay,
  prevTradingDay,
  firstWorkingDayOfMonth,
  lastTradingDayOfMonth,
  isFirstTradingDayOfWeek,
  isLastTradingDayOfWeek,
  addDays,
} from "./trading-day";

// Reference calendar (2026): Aug 3 = Mon, Aug 1 = Sat, Aug 2 = Sun,
// Jul 31 = Fri, Aug 7 = Fri, Aug 31 = Mon, Aug 28 = Fri.
const NONE = new Set<string>();

describe("trading-day arithmetic", () => {
  it("weekends", () => {
    expect(isWeekend("2026-08-01")).toBe(true); // Sat
    expect(isWeekend("2026-08-02")).toBe(true); // Sun
    expect(isWeekend("2026-08-03")).toBe(false); // Mon
  });

  it("addDays wraps months correctly", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("isTradingDay respects weekends and holidays", () => {
    expect(isTradingDay("2026-08-03", NONE)).toBe(true);
    expect(isTradingDay("2026-08-01", NONE)).toBe(false); // Sat
    expect(isTradingDay("2026-08-03", new Set(["2026-08-03"]))).toBe(false); // holiday
  });

  it("next/prev trading day skip weekends", () => {
    expect(nextTradingDay("2026-08-01", NONE)).toBe("2026-08-03"); // Sat → Mon
    expect(prevTradingDay("2026-08-03", NONE)).toBe("2026-07-31"); // Mon → Fri
  });

  it("next/prev trading day skip holidays too", () => {
    // Fri holiday → next from Thu is Mon; prev from Mon is Thu.
    const hol = new Set(["2026-08-07"]);
    expect(nextTradingDay("2026-08-06", hol)).toBe("2026-08-10"); // Thu → (skip Fri hol, w/e) → Mon
    expect(prevTradingDay("2026-08-10", hol)).toBe("2026-08-06"); // Mon → (skip w/e, Fri hol) → Thu
  });

  it("first working day of month", () => {
    expect(firstWorkingDayOfMonth(2026, 8, NONE)).toBe("2026-08-03"); // 1st is Sat → Mon 3rd
    expect(firstWorkingDayOfMonth(2026, 8, new Set(["2026-08-03"]))).toBe("2026-08-04"); // + Mon holiday → Tue
  });

  it("last trading day of month", () => {
    expect(lastTradingDayOfMonth(2026, 8, NONE)).toBe("2026-08-31"); // Mon
    expect(lastTradingDayOfMonth(2026, 8, new Set(["2026-08-31"]))).toBe("2026-08-28"); // Mon holiday → Fri
  });

  it("first/last trading day of week", () => {
    expect(isFirstTradingDayOfWeek("2026-08-03", NONE)).toBe(true); // Mon
    expect(isFirstTradingDayOfWeek("2026-08-04", NONE)).toBe(false); // Tue
    expect(isLastTradingDayOfWeek("2026-08-07", NONE)).toBe(true); // Fri
    expect(isLastTradingDayOfWeek("2026-08-06", NONE)).toBe(false); // Thu
  });

  it("week boundaries shift for holidays", () => {
    // Mon holiday → Tue is first trading day of week.
    expect(isFirstTradingDayOfWeek("2026-08-04", new Set(["2026-08-03"]))).toBe(true);
    // Fri holiday → Thu is last trading day of week.
    expect(isLastTradingDayOfWeek("2026-08-06", new Set(["2026-08-07"]))).toBe(true);
  });
});
