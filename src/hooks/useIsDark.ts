"use client";

import { useEffect, useState } from "react";

// Tracks whether the app is in dark mode (`.dark` on <html>) and re-reads when
// the user toggles the theme, so charts can pick a palette that stays legible
// on both surfaces instead of hardcoding light-only hex values.
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
