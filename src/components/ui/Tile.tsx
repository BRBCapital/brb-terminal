"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { NgxErrorCode, ProxyResult } from "@/lib/ngx/types";

export function Panel({
  title,
  subtitle,
  right,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx("brb-card flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-stone px-4 py-3">
        <div>
          <h3 className="font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 font-sans text-[11px] text-ink/50">{subtitle}</p>
          )}
        </div>
        {right && <div className="shrink-0 text-right">{right}</div>}
      </div>
      <div className={clsx("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

const ERROR_COPY: Record<
  NgxErrorCode,
  { title: string; hint: string; tone: "info" | "warn" | "block" }
> = {
  MISSING_API_KEY: {
    title: "API key not configured",
    hint: "Add NGNMARKET_API_KEY to .env.local (server-side) and restart.",
    tone: "block",
  },
  INVALID_API_KEY: {
    title: "API key rejected",
    hint: "The key was not found or has been revoked. Check the developer dashboard.",
    tone: "block",
  },
  PLAN_REQUIRED: {
    title: "Not on your plan",
    hint: "This data needs a higher NGN Market tier. Ask Admin to upgrade.",
    tone: "info",
  },
  IP_NOT_ALLOWED: {
    title: "IP not allowlisted",
    hint: "This server's IP is not permitted for the API key.",
    tone: "block",
  },
  RATE_LIMITED: {
    title: "Rate limited",
    hint: "Too many requests this minute. It will recover shortly.",
    tone: "warn",
  },
  QUOTA_EXCEEDED: {
    title: "Monthly quota reached",
    hint: "The account's monthly API quota is exhausted until it resets.",
    tone: "block",
  },
  NOT_FOUND: {
    title: "No data",
    hint: "No record was found for this request.",
    tone: "info",
  },
  SERVER_ERROR: {
    title: "Upstream error",
    hint: "The NGN Market API had an unexpected error. Try again.",
    tone: "warn",
  },
  INVALID_CURRENCY: {
    title: "Invalid currency",
    hint: "The requested currency code is not supported.",
    tone: "info",
  },
  UPSTREAM_UNAVAILABLE: {
    title: "Can't reach the API",
    hint: "The NGN Market API did not respond. Check connectivity.",
    tone: "warn",
  },
  UNKNOWN: {
    title: "Something went wrong",
    hint: "An unrecognized error occurred.",
    tone: "warn",
  },
};

function StateBox({
  title,
  hint,
  tone,
}: {
  title: string;
  hint: string;
  tone: "info" | "warn" | "block";
}) {
  return (
    <div
      className={clsx(
        "flex h-full min-h-24 flex-col items-start justify-center rounded-lg border border-dashed px-4 py-6",
        tone === "block" && "border-loss/40 bg-loss/5",
        tone === "warn" && "border-amber-400/50 bg-amber-50",
        tone === "info" && "border-stone bg-sand/60"
      )}
    >
      <p className="font-sans text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 font-sans text-xs text-ink/60">{hint}</p>
    </div>
  );
}

// Renders loading / error / empty for a proxied query, else the children.
export function TileBody<T>({
  query,
  isEmpty,
  children,
}: {
  query: UseQueryResult<ProxyResult<T>>;
  isEmpty?: (data: T) => boolean;
  children: (data: T, result: Extract<ProxyResult<T>, { ok: true }>) => ReactNode;
}) {
  if (query.isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-stone" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-stone" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-stone" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    const copy = ERROR_COPY.UPSTREAM_UNAVAILABLE;
    return <StateBox {...copy} />;
  }

  const result = query.data;
  if (!result.ok) {
    const copy = ERROR_COPY[result.error.code] ?? ERROR_COPY.UNKNOWN;
    const hint =
      result.error.code === "PLAN_REQUIRED" && result.error.required_plan
        ? `Requires the ${result.error.required_plan} plan or higher (you're on ${
            result.error.current_plan ?? "a lower tier"
          }).`
        : copy.hint;
    return <StateBox title={copy.title} hint={hint} tone={copy.tone} />;
  }

  if (isEmpty && isEmpty(result.data)) {
    return <StateBox {...ERROR_COPY.NOT_FOUND} />;
  }

  return <>{children(result.data, result)}</>;
}
