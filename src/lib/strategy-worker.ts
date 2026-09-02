import "server-only";
import { tick } from "./engine/scheduler";

// Started once from instrumentation.ts (nodejs runtime only). Runs the
// strategies-engine scheduler on a 60s tick; each tick is a no-op unless the
// engine is enabled (governance gate) and a cadence job is inside its window.
// Job dedup is enforced in the DB, so overlapping ticks never double-fire.
export function startStrategyWorker() {
  const g = globalThis as unknown as { __strategyWorker?: boolean };
  if (g.__strategyWorker) return;
  g.__strategyWorker = true;

  const run = async () => {
    try {
      await tick();
    } catch (err) {
      console.error("[engine] scheduler tick failed", err);
    }
  };
  setTimeout(run, 10_000);
  setInterval(run, 60 * 1000);
  console.log("[engine] strategies worker started");
}
