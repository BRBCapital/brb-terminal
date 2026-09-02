import { WatchlistDetail } from "@/components/watchlist/WatchlistDetail";

export const metadata = { title: "Watchlist · BRB NGX Analyst" };

export default function WatchlistDetailPage({ params }: { params: { id: string } }) {
  return <WatchlistDetail id={params.id} />;
}
