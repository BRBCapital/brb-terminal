import { SectionHeader } from "@/components/ui/SectionHeader";
import { InstrumentsClient } from "@/components/instruments/InstrumentsClient";
import { ComplianceNote } from "@/components/ui/ComplianceNote";

export const metadata = { title: "Bonds & ETFs · BRB NGX Analyst" };

export default function InstrumentsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader number="09" eyebrow="Fixed Income & Funds" title="Bonds & ETFs" />
      <InstrumentsClient />
      <ComplianceNote />
    </div>
  );
}
