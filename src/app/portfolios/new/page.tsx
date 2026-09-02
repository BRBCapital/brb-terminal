import { Suspense } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PortfolioBuilder } from "@/components/portfolio/PortfolioBuilder";

export const metadata = { title: "New portfolio · BRB NGX Analyst" };

export default function NewPortfolioPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        number="04"
        eyebrow="Portfolio Construction"
        title="Build a Model Portfolio"
      />
      {/* PortfolioBuilder reads ?from= via useSearchParams — needs a Suspense
          boundary for static prerendering (Next 14). */}
      <Suspense fallback={null}>
        <PortfolioBuilder />
      </Suspense>
    </div>
  );
}
