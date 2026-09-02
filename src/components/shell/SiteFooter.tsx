import { BrbMark } from "@/components/brand/BrbLogo";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-stone bg-forest text-[#F5F2EC]/80 print:hidden">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-5 sm:px-6 lg:px-8">
        <BrbMark size={26} />
        <div className="flex flex-col gap-1">
          <p className="font-serif text-sm font-semibold text-[#F5F2EC]">
            BRB Capital Group — Inclusive Wealth. Beyond Borders.
          </p>
          <p className="font-sans text-[11px] uppercase tracking-eyebrow text-[#F5F2EC]/60">
            Internal analytical tool. Not investment advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
