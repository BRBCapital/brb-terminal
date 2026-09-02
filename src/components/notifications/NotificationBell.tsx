"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, RefreshCw, Check } from "lucide-react";
import { useUser } from "@/components/auth/AuthProvider";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@/lib/db/notifications";

export function NotificationBell() {
  const { user } = useUser();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const b = await res.json();
    if (b.ok) {
      setItems(b.notifications);
      setUnread(b.unread);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [user, load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  async function checkNow() {
    setBusy(true);
    await fetch("/api/notifications/evaluate", { method: "POST" });
    await load();
    setBusy(false);
  }
  async function markAll() {
    await fetch("/api/notifications/read", { method: "POST", body: "{}" });
    await load();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        className="relative flex h-7 w-7 items-center justify-center rounded-md text-[#F5F2EC]/70 hover:bg-forest-soft hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fresh px-1 text-[9px] font-bold text-forest">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 overflow-hidden rounded-lg border border-stone bg-surface text-ink shadow-card">
          <div className="flex items-center justify-between border-b border-stone px-3 py-2">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest">
              Notifications
            </span>
            <div className="flex gap-1">
              <button onClick={checkNow} disabled={busy} title="Check now" className="rounded p-1 text-ink/40 hover:bg-sand hover:text-forest">
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              </button>
              {unread > 0 && (
                <button onClick={markAll} title="Mark all read" className="rounded p-1 text-ink/40 hover:bg-sand hover:text-forest">
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center font-sans text-[12px] text-ink/45">
              No notifications. Price and ex-dividend alerts appear here.
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto divide-y divide-stone">
              {items.map((n) => (
                <li key={n.id} className={n.read_at ? "bg-surface" : "bg-fresh/5"}>
                  <Link
                    href={
                      n.portfolio_id
                        ? `/portfolios/${n.portfolio_id}/manage`
                        : n.symbol
                        ? `/stocks/${n.symbol}`
                        : "#"
                    }
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 hover:bg-sand"
                  >
                    <p className="font-sans text-[12px] text-ink/80">{n.message}</p>
                    <p className="mt-0.5 font-sans text-[9px] uppercase tracking-eyebrow text-ink/40">
                      {n.symbol} · {timeAgo(n.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
