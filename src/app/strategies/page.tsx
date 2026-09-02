import type { Metadata } from "next";
import { StrategiesLanding } from "@/components/strategies/StrategiesLanding";

export const metadata: Metadata = {
  title: "Alternative Strategies — AI-native quant for frontier markets",
  description:
    "An AI-native quantitative platform that carries a strategy from signal to governed execution — engineered for the liquidity, data gaps and FX regimes of emerging markets. Starting with the NGX. Simulated / illustrative.",
};

// Public marketing landing for Alternative Strategies. Excluded from the login
// gate in middleware; renders full-bleed (no app chrome) via AppFrame.
export default function StrategiesPage() {
  return <StrategiesLanding />;
}
