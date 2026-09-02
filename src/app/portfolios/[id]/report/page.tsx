import { PortfolioReportClient } from "@/components/portfolio/report/PortfolioReportClient";

export const metadata = { title: "Portfolio report · BRB NGX Analyst" };

export default function PortfolioReportPage({ params }: { params: { id: string } }) {
  return <PortfolioReportClient id={params.id} />;
}
