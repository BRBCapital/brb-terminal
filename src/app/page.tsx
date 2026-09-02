import { SectionHeader } from "@/components/ui/SectionHeader";
import { ComplianceNote } from "@/components/ui/ComplianceNote";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { MarketStatusBanner } from "@/components/dashboard/MarketStatusBanner";
import { SnapshotHero } from "@/components/dashboard/SnapshotHero";
import { IndicesStrip } from "@/components/dashboard/IndicesStrip";
import { ForexWidget } from "@/components/dashboard/ForexWidget";
import { MoversTile } from "@/components/dashboard/MoversTile";
import { TopTradesTile } from "@/components/dashboard/TopTradesTile";
import { SectorHeatmap } from "@/components/dashboard/SectorHeatmap";
import { YtdPerformers } from "@/components/dashboard/YtdPerformers";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        number="01"
        eyebrow="Market Dashboard"
        title="NGX Daily Overview"
      />

      <DashboardTabs
        overview={
          <div className="space-y-6">
            <MarketStatusBanner />
            <SnapshotHero />
            <IndicesStrip />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <TopTradesTile />
              </div>
              <ForexWidget />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MoversTile />
              <YtdPerformers />
            </div>

            <SectorHeatmap />

            <ComplianceNote />
          </div>
        }
      />
    </div>
  );
}
