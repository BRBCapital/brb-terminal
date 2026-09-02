import clsx from "clsx";
import { changeTone, formatPercent } from "@/lib/format";

interface DeltaProps {
  value: number | null | undefined;
  // Show as percentage (default) or a raw formatted string alongside.
  suffix?: string;
  className?: string;
  showArrow?: boolean;
  decimals?: number;
}

// Green for positive, brand red for negative. Used everywhere a price change
// appears so gains/losses read consistently.
export function Delta({
  value,
  suffix,
  className,
  showArrow = true,
  decimals = 2,
}: DeltaProps) {
  const tone = changeTone(value);
  const arrow = tone === "up" ? "▲" : tone === "down" ? "▼" : "•";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 font-sans font-semibold tabular-nums",
        tone === "up" && "text-forest-soft",
        tone === "down" && "text-loss",
        tone === "flat" && "text-ink/50",
        className
      )}
    >
      {showArrow && <span className="text-[0.7em]">{arrow}</span>}
      {formatPercent(value, decimals)}
      {suffix ? <span className="font-normal text-ink/50">{suffix}</span> : null}
    </span>
  );
}
