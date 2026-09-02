import "server-only";
import { evaluateAlerts } from "./db/notifications";
import { evaluatePriceAlerts } from "./db/price-alerts";

// Started once from instrumentation.ts (nodejs runtime only). Evaluates active
// alerts on an interval and writes notifications for newly-triggered ones.
export function startAlertWorker() {
  const g = globalThis as unknown as { __alertWorker?: boolean };
  if (g.__alertWorker) return;
  g.__alertWorker = true;

  const run = async () => {
    try {
      const [portfolioN, priceN] = await Promise.all([
        evaluateAlerts(),
        evaluatePriceAlerts(),
      ]);
      const n = portfolioN + priceN;
      if (n > 0) console.log(`[alerts] created ${n} notification(s)`);
    } catch (err) {
      console.error("[alerts] evaluation failed", err);
    }
  };
  setTimeout(run, 8000);
  setInterval(run, 3 * 60 * 1000);
  console.log("[alerts] background worker started");
}
