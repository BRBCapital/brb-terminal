import { EtfDetailClient } from "@/components/instruments/EtfDetailClient";

export function generateMetadata({ params }: { params: { symbol: string } }) {
  return { title: `${params.symbol.toUpperCase()} ETF · BRB NGX Analyst` };
}

export default function EtfPage({ params }: { params: { symbol: string } }) {
  return <EtfDetailClient symbol={params.symbol.toUpperCase()} />;
}
