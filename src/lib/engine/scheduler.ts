// The scheduler decides which cadence jobs are due for a given WAT wall-clock +
// holiday calendar. `dueJobs` is PURE (unit-tested); `tick` wires it to the DB,
// the live holiday feed, and the open/close job functions.

import { CLOSE_MIN, OPEN_PLUS_30, watClock, type WatClock } from "./clock";
import {
  firstWorkingDayOfMonth,
  isFirstTradingDayOfWeek,
  isLastTradingDayOfWeek,
  isTradingDay,
  lastTradingDayOfMonth,
  loadHolidays,
} from "./trading-day";
import type { Cadence } from "@/lib/db/strategy";
import { getSettings } from "@/lib/db/strategy";
import { closeCadence, openCadence } from "./run";

export interface JobDecision {
  action: "open" | "close";
  cadence: Cadence;
  runKey: string;
}

const inOpenWindow = (m: number) => m >= OPEN_PLUS_30 && m < CLOSE_MIN; // 09:30–16:00
const afterClose = (m: number) => m >= CLOSE_MIN; // ≥16:00

// Which open/close jobs are eligible right now. Dedup (once per key) is enforced
// downstream by the strategy_runs UNIQUE claim — this only gates the window.
export function dueJobs(clock: WatClock, holidays: Set<string>): JobDecision[] {
  const jobs: JobDecision[] = [];
  const today = clock.dateStr;
  const period = today.slice(0, 7);
  if (!isTradingDay(today, holidays)) return jobs;

  const opening = inOpenWindow(clock.minutes);
  const closing = afterClose(clock.minutes);

  // Intraday — every trading day.
  if (opening) jobs.push({ action: "open", cadence: "intraday", runKey: today });
  if (closing) jobs.push({ action: "close", cadence: "intraday", runKey: today });

  // Weekly — open on the first trading day of the week, close on the last.
  if (opening && isFirstTradingDayOfWeek(today, holidays))
    jobs.push({ action: "open", cadence: "weekly", runKey: today });
  if (closing && isLastTradingDayOfWeek(today, holidays))
    jobs.push({ action: "close", cadence: "weekly", runKey: today });

  // Monthly — open on the first working day, close on the last trading day.
  if (opening && firstWorkingDayOfMonth(clock.year, clock.month, holidays) === today)
    jobs.push({ action: "open", cadence: "monthly", runKey: period });
  if (closing && lastTradingDayOfMonth(clock.year, clock.month, holidays) === today)
    jobs.push({ action: "close", cadence: "monthly", runKey: period });

  return jobs;
}

// One scheduler cycle. No-op unless the engine is enabled (governance gate).
export async function tick(now: Date = new Date()): Promise<void> {
  const settings = await getSettings();
  if (!settings.enabled) return;

  const holidays = await loadHolidays();
  const clock = watClock(now);
  const jobs = dueJobs(clock, holidays);

  for (const j of jobs) {
    if (j.action === "open") {
      await openCadence(j.cadence, { runKey: j.runKey, trigger: "schedule", dateStr: clock.dateStr });
    } else {
      await closeCadence(j.cadence, {
        runKey: j.runKey,
        trigger: "schedule",
        dateStr: clock.dateStr,
        mode: "scheduled",
      });
    }
  }
}
