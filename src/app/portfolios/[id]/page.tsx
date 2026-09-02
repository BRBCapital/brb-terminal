import { PortfolioView } from "@/components/portfolio/PortfolioView";

export const metadata = { title: "Portfolio · BRB NGX Analyst" };

export default function PortfolioDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <PortfolioView id={params.id} />;
}
