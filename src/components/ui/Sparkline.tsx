// Tiny dependency-free SVG sparkline for watchlist mini charts.
export function Sparkline({
  values,
  width = 96,
  height = 28,
  strokeWidth = 1.25,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  const clean = values.filter((v) => v != null && !Number.isNaN(v));
  if (clean.length < 2) {
    return <div style={{ width, height }} className="rounded bg-stone/50" />;
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const stepX = width / (clean.length - 1);
  const points = clean
    .map((v, i) => `${(i * stepX).toFixed(2)},${(height - ((v - min) / span) * height).toFixed(2)}`)
    .join(" ");
  const up = clean[clean.length - 1] >= clean[0];
  // Mid green (not the near-black #1A4D40) so gains read on both the light sand
  // and dark forest surfaces.
  const color = up ? "#4E9E6B" : "#C0392B";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
