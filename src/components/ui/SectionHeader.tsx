interface SectionHeaderProps {
  number?: string; // e.g. "01"
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}

export function SectionHeader({
  number,
  eyebrow,
  title,
  action,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <span className="brb-eyebrow">
          {number && <span className="brb-eyebrow-num">{number}</span>}
          {eyebrow}
        </span>
        <h2 className="brb-title mt-1">{title}</h2>
        <div className="brb-underline" />
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
