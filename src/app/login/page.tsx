"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/auth/AuthProvider";
import { BrbLogo } from "@/components/brand/BrbLogo";

const CAPABILITIES = [
  "NGX market dashboard & screener",
  "Company research & AI scenario modelling",
  "Model portfolios, risk & PFM approvals",
];

// useSearchParams() must sit under a Suspense boundary or the page can't be
// statically prerendered (Next 14 CSR-bailout requirement).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useUser();
  // Only ever redirect to a same-origin absolute path. Reject anything that
  // could navigate off-site: absolute URLs, protocol-relative "//evil.com", and
  // backslash tricks some browsers treat as protocol-relative.
  const rawNext = params.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!body.ok) {
        setError(body.error ?? "Sign-in failed.");
        setBusy(false);
        return;
      }
      await refresh();
      router.replace(next);
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-4xl items-center">
      <div className="brb-card grid w-full overflow-hidden md:grid-cols-5">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between bg-forest p-8 text-[#F5F2EC] md:col-span-2 md:flex">
          <div>
            <BrbLogo onDark size={44} />
            <div className="mt-3 h-1 w-12 rounded-full bg-fresh" />
            <p className="mt-6 font-serif text-lg leading-snug text-[#F5F2EC]/90">
              Research, portfolios and forward scenarios for the Nigerian
              Exchange — in one desk.
            </p>
            <ul className="mt-6 space-y-2">
              {CAPABILITIES.map((c) => (
                <li key={c} className="flex items-start gap-2 font-sans text-[12px] text-[#F5F2EC]/75">
                  <span className="mt-px text-fresh">▸</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-serif text-[13px] font-semibold text-[#F5F2EC]/90">
              Inclusive Wealth. Beyond Borders.
            </p>
            <p className="mt-1 font-sans text-[9px] uppercase tracking-eyebrow text-[#F5F2EC]/50">
              Internal analytical tool · Not investment advice
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-8 md:col-span-3">
          <span className="brb-eyebrow">
            <span className="brb-eyebrow-num">B</span>Staff access
          </span>
          <h1 className="brb-title mt-1">Sign in</h1>
          <div className="brb-underline" />

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                Work email
              </label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-stone bg-surface px-3 py-2.5 font-sans text-sm outline-none transition-colors focus:border-fresh"
                placeholder="you@brb.local"
              />
            </div>
            <div>
              <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-stone bg-surface px-3 py-2.5 font-sans text-sm outline-none transition-colors focus:border-fresh"
              />
            </div>
            {error && <p className="font-sans text-[12px] text-loss">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-fresh px-4 py-2.5 font-sans text-sm font-semibold text-forest transition-all hover:brightness-95 disabled:opacity-40"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 font-sans text-[10px] leading-relaxed text-ink/45">
            Internal staff access only. Contact an administrator if you can&apos;t
            sign in.
          </p>
        </div>
      </div>
    </div>
  );
}
