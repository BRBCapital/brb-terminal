import { AlertTriangle } from "lucide-react";

// Mandatory, persistent label on EVERY forecast output (compliance guardrail).
export function ForecastDisclaimer({ compact = false }: { compact?: boolean }) {
  const text =
    "Illustrative scenario based on stated assumptions and a statistical model — not a prediction, recommendation, or guarantee. Past performance does not indicate future results.";
  if (compact) {
    return (
      <p className="font-sans text-[10px] leading-relaxed text-ink/45">{text}</p>
    );
  }
  return (
    <div className="brb-callout flex items-start gap-2 rounded-r-lg bg-amber-50 dark:bg-amber-950/30 py-2.5">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
      <p className="font-sans text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">{text}</p>
    </div>
  );
}
