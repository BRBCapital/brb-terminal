import { SectionHeader } from "@/components/ui/SectionHeader";
import { ComplianceNote } from "@/components/ui/ComplianceNote";
import { ScreenerClient } from "@/components/screener/ScreenerClient";

export const metadata = { title: "Screener · BRB NGX Analyst" };

export default function ScreenerPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        number="03"
        eyebrow="Screener"
        title="Screen NGX Equities"
      />
      <ScreenerClient />
      <ComplianceNote>
        Screening output is an analytical aid requiring PM/IC review — it is not a
        recommendation to trade. Prices are delayed up to 20 minutes during NGX
        hours. Past performance does not indicate future results.
      </ComplianceNote>
    </div>
  );
}
