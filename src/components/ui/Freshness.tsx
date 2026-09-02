import { formatTimestamp, timeAgo } from "@/lib/format";

// Compliance requirement: analysts must never mistake a delayed / prior-close
// price for a live quote. Show the upstream data timestamp explicitly, plus a
// hint when our cache served it.
export function Freshness({
  updatedAt,
  cached,
  fetchedAt,
  label = "As of",
}: {
  updatedAt: string | null | undefined;
  cached?: boolean;
  fetchedAt?: string | null;
  label?: string;
}) {
  return (
    <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
      {label} {formatTimestamp(updatedAt)} WAT
      {cached && fetchedAt ? (
        <span className="ml-1 normal-case tracking-normal text-ink/35">
          · cached {timeAgo(fetchedAt)}
        </span>
      ) : null}
    </p>
  );
}
