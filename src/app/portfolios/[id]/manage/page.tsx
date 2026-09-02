import { ManageClient } from "@/components/portfolio/manage/ManageClient";

export const metadata = { title: "Manage portfolio · BRB NGX Analyst" };

export default function ManagePortfolioPage({
  params,
}: {
  params: { id: string };
}) {
  return <ManageClient id={params.id} />;
}
