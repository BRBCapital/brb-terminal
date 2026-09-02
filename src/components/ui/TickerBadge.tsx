"use client";

import { useState } from "react";

// Company logo with graceful fallback to the ticker initials. Logos come from a
// public CDN and occasionally 404, so we never let a broken image break a row.
export function TickerBadge({
  symbol,
  logoUrl,
  size = 28,
}: {
  symbol: string;
  logoUrl?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size };

  if (!logoUrl || failed) {
    return (
      <span
        style={dim}
        className="flex shrink-0 items-center justify-center rounded-md bg-forest/10 font-sans text-[10px] font-bold text-forest"
      >
        {symbol.slice(0, 3)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      style={dim}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-md bg-surface object-contain"
    />
  );
}
