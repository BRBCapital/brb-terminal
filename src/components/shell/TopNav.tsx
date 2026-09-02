"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { UserMenu } from "@/components/auth/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { BrbLogo } from "@/components/brand/BrbLogo";
import { AppSwitcher } from "@/components/shell/AppSwitcher";
import { useUser } from "@/components/auth/AuthProvider";

const NAV: Array<{ label: string; href: string }> = [
  { label: "Dashboard", href: "/" },
  { label: "Stocks", href: "/stocks" },
  { label: "Screener", href: "/screener" },
  { label: "Portfolios", href: "/portfolios" },
  { label: "Watchlists", href: "/watchlists" },
  { label: "Calendar", href: "/calendar" },
  { label: "Instruments", href: "/instruments" },
  { label: "Forecasting", href: "/forecasting" },
];

export function TopNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const onEngine = pathname.startsWith("/engine");
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-forest-soft/40 bg-forest text-[#F5F2EC] shadow-[0_1px_0_rgba(0,0,0,0.25)] print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#F5F2EC]/80 transition-colors hover:bg-forest-soft lg:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-3">
          <BrbLogo onDark size={30} />
          <span className="hidden h-6 w-px bg-[#F5F2EC]/20 xl:block" />
          <span className="hidden whitespace-nowrap font-sans text-[10px] font-medium uppercase tracking-eyebrow text-[#F5F2EC]/60 xl:block">
            {onEngine ? "Strategies Engine" : "NGX Analyst"}
          </span>
        </Link>

        <AppSwitcher />

        {/* Desktop nav — hidden inside the engine app (its own surface) */}
        <nav className="hidden h-full items-center lg:flex">
          {!onEngine &&
            NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "group relative flex h-14 items-center whitespace-nowrap px-2.5 font-sans text-[11.5px] font-medium uppercase tracking-eyebrow transition-colors xl:px-3 xl:text-[12px]",
                  active ? "text-white" : "text-[#F5F2EC]/65 hover:text-white"
                )}
              >
                {item.label}
                <span
                  className={clsx(
                    "absolute inset-x-2.5 bottom-0 h-0.5 rounded-t-full transition-all",
                    active ? "bg-fresh" : "bg-transparent group-hover:bg-[#F5F2EC]/25"
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <ThemeToggle />
          <NotificationBell />
          <span className="hidden h-6 w-px bg-[#F5F2EC]/15 sm:block" />
          <UserMenu />
        </div>
      </div>

      {/* Mobile nav panel */}
      {mobileOpen && (
        <nav className="border-t border-forest-soft/40 bg-forest px-3 pb-3 pt-2 lg:hidden">
          {user?.role === "admin" && (
            <Link
              href={onEngine ? "/" : "/engine"}
              className="mb-1 flex items-center rounded-lg bg-fresh px-3 py-2.5 font-sans text-[13px] font-semibold uppercase tracking-eyebrow text-forest"
            >
              {onEngine ? "← Analyst Terminal" : "Strategies Engine →"}
            </Link>
          )}
          {!onEngine &&
            NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center rounded-lg px-3 py-2.5 font-sans text-[13px] font-medium uppercase tracking-eyebrow transition-colors",
                  active
                    ? "bg-forest-soft text-white"
                    : "text-[#F5F2EC]/75 hover:bg-forest-soft/60 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
