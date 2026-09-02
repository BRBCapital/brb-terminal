export function ComplianceNote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="brb-callout py-2">
      <p className="font-sans text-[11px] leading-relaxed text-ink/55">
        {children ??
          "Prices are delayed up to 20 minutes during NGX hours and reflect the last session close outside trading hours. Past performance does not indicate future results. For internal analytical use only — not investment advice."}
      </p>
    </div>
  );
}
