import { SectionHeader } from "@/components/ui/SectionHeader";
import { PortfoliosShell } from "@/components/portfolio/PortfoliosShell";

export const metadata = { title: "Portfolios · BRB NGX Analyst" };

export default function PortfoliosPage() {
  return (
    <div className="space-y-6">
      <SectionHeader number="04" eyebrow="Portfolios" title="Portfolios & AI Builder" />
      <PortfoliosShell />
    </div>
  );
}
