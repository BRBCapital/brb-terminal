"use client";

import { useEffect, useState } from "react";

// BRB Capital brand lockup. On dark surfaces (nav, login) BrbLogo prefers the
// official raster at /public/brb-logo.png when that file is present; otherwise —
// and on light surfaces (print header) — it renders the background-free vector
// recreation below (RSS-style arcs + "BRB" wordmark + "Capital" + green bar).
// Drop the asset in /public/brb-logo.png to activate it; no other change needed.
const LOGO_ASSET = "/brb-logo.png";

export function BrbMark({ size = 32 }: { size?: number }) {
  // Origin of the signal, near the lower-left corner of the 96×96 canvas; the
  // three arcs are concentric quarter-circles fanning out to the upper-right.
  const ox = 25;
  const oy = 71;
  const arc = (r: number, color: string) => (
    <path
      d={`M ${ox} ${oy - r} A ${r} ${r} 0 0 1 ${ox + r} ${oy}`}
      stroke={color}
      strokeWidth="12"
      strokeLinecap="round"
      fill="none"
    />
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* outer → inner arcs, a subtle light-to-deep green for depth */}
      {arc(48, "#93CE7E")}
      {arc(33, "#8AC873")}
      {arc(18, "#7CBF61")}
      {/* the emitter dot */}
      <circle cx={ox} cy={oy} r="7.5" fill="#7CBF61" />
    </svg>
  );
}

export function BrbLogo({
  onDark = false,
  size = 32,
  className,
}: {
  // onDark: light wordmark for forest/dark surfaces; otherwise brand forest.
  onDark?: boolean;
  size?: number;
  className?: string;
}) {
  const text = onDark ? "#F5F2EC" : "#052A22";

  // Only the dark surfaces use the raster (its dark background blends with the
  // forest nav). Preload it so we swap in cleanly IF present — never a broken
  // image: if the file is missing, we simply keep the vector below.
  const [assetReady, setAssetReady] = useState(false);
  useEffect(() => {
    if (!onDark) return;
    const img = new Image();
    img.onload = () => setAssetReady(true);
    img.src = LOGO_ASSET;
  }, [onDark]);

  if (onDark && assetReady) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_ASSET}
        alt="BRB Capital"
        className={className}
        style={{ height: size * 1.25, width: "auto", display: "block" }}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <BrbMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className="font-sans font-extrabold tracking-tight"
          style={{ color: text, fontSize: size * 0.64 }}
        >
          BRB
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span
            className="font-sans font-semibold"
            style={{ color: text, fontSize: size * 0.2, letterSpacing: "0.14em" }}
          >
            Capital
          </span>
          <span
            className="rounded-[2px] bg-fresh"
            style={{ width: size * 0.42, height: size * 0.13 }}
          />
        </span>
      </span>
    </span>
  );
}
