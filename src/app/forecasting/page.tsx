import { SectionHeader } from "@/components/ui/SectionHeader";
import { CompanySearch } from "@/components/search/CompanySearch";
import { ForecastDisclaimer } from "@/components/forecast/ForecastDisclaimer";

export const metadata = { title: "Forecasting · BRB NGX Analyst" };

export default function ForecastingLandingPage() {
  return (
    <div className="space-y-6">
      <SectionHeader number="05" eyebrow="Forecasting & Scenarios" title="Forward Scenarios" />
      <div className="brb-card p-6">
        <p className="mb-3 font-sans text-[12px] uppercase tracking-eyebrow text-forest-soft">
          Model a company forward
        </p>
        <div className="max-w-xl">
          <CompanySearch
            autoFocus
            placeholder="Search ticker or company to forecast…"
            basePath="/forecasting"
          />
        </div>
        <p className="mt-3 font-sans text-[12px] text-ink/50">
          Monte Carlo price paths, fundamental scenarios, dividend projections and
          macro context — all illustrative, none a prediction.
        </p>
      </div>
      <ForecastDisclaimer />
    </div>
  );
}
