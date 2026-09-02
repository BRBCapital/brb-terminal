import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PortfolioBuilder } from "@/components/portfolio/PortfolioBuilder";
import { getPortfolio } from "@/lib/db/portfolios";

export const metadata = { title: "Edit portfolio · BRB NGX Analyst" };
export const dynamic = "force-dynamic";

export default async function EditPortfolioPage({
  params,
}: {
  params: { id: string };
}) {
  const portfolio = await getPortfolio(params.id);
  if (!portfolio) notFound();
  return (
    <div className="space-y-6">
      <SectionHeader
        number="04"
        eyebrow="Portfolio Construction"
        title={`Edit — ${portfolio.name}`}
      />
      <PortfolioBuilder initial={portfolio} />
    </div>
  );
}
