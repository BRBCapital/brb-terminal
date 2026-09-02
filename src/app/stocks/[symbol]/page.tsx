import { StockClient } from "@/components/stock/StockClient";
import { ComplianceNote } from "@/components/ui/ComplianceNote";

export function generateMetadata({ params }: { params: { symbol: string } }) {
  return { title: `${params.symbol.toUpperCase()} · BRB NGX Analyst` };
}

export default function StockPage({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase();
  return (
    <div className="space-y-4">
      <StockClient symbol={symbol} />
      <ComplianceNote>
        Research view for internal analytical use. Prices are delayed up to 20
        minutes during NGX hours and reflect the last session close outside
        trading hours. Ratios and technical indicators are computed from reported
        figures and end-of-day closes. Not investment advice; past performance does
        not indicate future results.
      </ComplianceNote>
    </div>
  );
}
