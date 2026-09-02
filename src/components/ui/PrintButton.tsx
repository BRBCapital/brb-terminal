"use client";

import { Printer } from "lucide-react";
import { BrbLogo } from "@/components/brand/BrbLogo";

// Uses the browser's print → "Save as PDF" to produce an IC-pack one-pager.
// Chrome/Safari/Edge all offer Save-as-PDF from the print dialog.
export function PrintButton({ label = "PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1 rounded-lg border border-stone px-3 py-1.5 font-sans text-[12px] font-semibold text-forest hover:bg-sand print:hidden"
      title="Print / save as PDF"
    >
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

// Print-only header stamped onto exported one-pagers.
export function PrintHeader({ title }: { title: string }) {
  return (
    <div className="hidden border-b border-stone pb-2 print:block">
      <div className="flex items-center justify-between">
        <BrbLogo size={30} />
        <span className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/50">
          {title}
        </span>
      </div>
      <p className="mt-1 font-sans text-[9px] uppercase tracking-eyebrow text-ink/45">
        Inclusive Wealth. Beyond Borders. · Internal analytical tool · Not
        investment advice
      </p>
    </div>
  );
}
