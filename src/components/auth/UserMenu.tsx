"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Settings, LogOut, ClipboardCheck, ChevronDown } from "lucide-react";
import { useUser, ROLE_BADGE, ROLE_LABEL } from "./AuthProvider";

// Initials for the avatar, e.g. "Bassey Etim" -> "BE".
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Account menu: an avatar chip that opens a dropdown with the user's identity,
// role-gated shortcuts, and a prominent, clearly-labelled Sign out button.
export function UserMenu() {
  const { user, loading, logout } = useUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (loading) {
    return <span className="h-8 w-8 animate-pulse rounded-full bg-forest-soft/50" />;
  }
  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-lg bg-fresh px-3.5 py-1.5 font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest transition-all hover:brightness-95"
      >
        Sign in
      </Link>
    );
  }

  async function signOut() {
    setBusy(true);
    await logout();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 transition-colors hover:bg-forest-soft/70 xl:pr-2.5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fresh text-[12px] font-bold text-forest">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-[9rem] text-left leading-tight xl:block">
          <span className="block truncate font-sans text-[12px] font-semibold text-[#F5F2EC]">{user.name}</span>
          <span className="block font-sans text-[9px] uppercase tracking-eyebrow text-fresh/80">
            {ROLE_BADGE[user.role]}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#F5F2EC]/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-stone bg-surface text-ink shadow-card"
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 border-b border-stone bg-sand/60 px-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fresh text-[14px] font-bold text-forest">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-sans text-[13px] font-semibold text-forest">{user.name}</p>
              <p className="truncate font-sans text-[11px] text-ink/55">{user.email}</p>
              <span className="mt-1 inline-block rounded-full bg-fresh/15 px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-eyebrow text-forest-soft">
                {ROLE_LABEL[user.role]}
              </span>
            </div>
          </div>

          {/* Role-gated shortcuts */}
          {(user.role === "pm" || user.role === "admin") && (
            <div className="py-1">
              {(user.role === "pm" || user.role === "admin") && (
                <MenuLink
                  href="/approvals"
                  icon={<ClipboardCheck className="h-4 w-4" />}
                  label="Rebalancing approvals"
                  onNavigate={() => setOpen(false)}
                />
              )}
              {user.role === "admin" && (
                <MenuLink
                  href="/admin"
                  icon={<Settings className="h-4 w-4" />}
                  label="Admin & quota"
                  onNavigate={() => setOpen(false)}
                />
              )}
            </div>
          )}

          {/* Sign out */}
          <div className="border-t border-stone p-2">
            <button
              onClick={signOut}
              disabled={busy}
              role="menuitem"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-loss/10 px-3 py-2 font-sans text-[13px] font-semibold text-loss transition-colors hover:bg-loss/20 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      role="menuitem"
      className="flex items-center gap-2.5 px-3 py-2 font-sans text-[13px] text-ink/80 transition-colors hover:bg-sand"
    >
      <span className="text-forest-soft">{icon}</span>
      {label}
    </Link>
  );
}
