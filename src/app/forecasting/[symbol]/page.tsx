import { ForecastClient } from "@/components/forecast/ForecastClient";

export function generateMetadata({ params }: { params: { symbol: string } }) {
  return { title: `${params.symbol.toUpperCase()} forecast · BRB NGX Analyst` };
}

export default function ForecastPage({ params }: { params: { symbol: string } }) {
  return <ForecastClient symbol={params.symbol.toUpperCase()} />;
}
