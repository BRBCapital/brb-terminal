import { SectionHeader } from "@/components/ui/SectionHeader";
import { CalendarClient } from "@/components/calendar/CalendarClient";

export const metadata = { title: "Calendar · BRB NGX Analyst" };

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        number="08"
        eyebrow="Catalyst Calendar"
        title="Corporate Actions & Catalysts"
      />
      <CalendarClient />
    </div>
  );
}
