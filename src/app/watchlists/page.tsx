import { SectionHeader } from "@/components/ui/SectionHeader";
import { WatchlistList } from "@/components/watchlist/WatchlistList";

export const metadata = { title: "Watchlists · BRB NGX Analyst" };

export default function WatchlistsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader number="07" eyebrow="Watchlists" title="Your Watchlists" />
      <WatchlistList />
    </div>
  );
}
