import { SectionHeader } from "@/components/ui/SectionHeader";
import { CompanySearch } from "@/components/search/CompanySearch";
import { ComplianceNote } from "@/components/ui/ComplianceNote";

export const metadata = { title: "Stock Analysis · BRB NGX Analyst" };

export default function StocksLandingPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        number="02"
        eyebrow="Stock Analysis"
        title="Company Research"
      />
      <div className="brb-card p-6">
        <p className="mb-3 font-sans text-[12px] uppercase tracking-eyebrow text-forest-soft">
          Look up an NGX-listed company
        </p>
        <div className="max-w-xl">
          <CompanySearch autoFocus />
        </div>
        <p className="mt-3 font-sans text-[12px] text-ink/50">
          Search by ticker (e.g. <span className="font-semibold">DANGCEM</span>,{" "}
          <span className="font-semibold">GTCO</span>,{" "}
          <span className="font-semibold">MTNN</span>) or company name, or browse
          the <a href="/screener" className="text-forest-soft underline">screener</a>.
        </p>
      </div>
      <ComplianceNote />
    </div>
  );
}
