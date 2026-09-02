// Runs once when the Next.js server starts. The nodejs-only dynamic import keeps
// the alert worker (and its Node built-ins) out of the edge bundle.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAlertWorker } = await import("./lib/alert-worker");
    startAlertWorker();
    const { startStrategyWorker } = await import("./lib/strategy-worker");
    startStrategyWorker();
  }
}
