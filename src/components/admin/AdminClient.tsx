"use client";

import { useEffect, useState } from "react";
import { fetchProxy } from "@/lib/ngx/browser";
import { Panel } from "@/components/ui/Tile";
import { CsvExportButton } from "@/components/ui/ExportButtons";
import { ApiKeySettings } from "./ApiKeySettings";
import { UserManagement } from "./UserManagement";
import { formatNumber, formatDate, formatTimestamp } from "@/lib/format";
import type { AuditEntry } from "@/lib/db/audit";

interface Usage {
  period: string;
  calls_used: number;
  calls_limit: number;
  calls_remaining: number;
  reset_at: string;
  daily: Array<{ date: string; calls: number }>;
  top_endpoints: Array<{ endpoint: string; calls: number }>;
  status_breakdown: Record<string, number>;
}
interface LogRow {
  id: number;
  method: string;
  endpoint: string;
  status_code: number;
  latency_ms: number;
  timestamp: string;
}
interface Logs {
  logs: LogRow[];
}

export function AdminClient() {
  const [usage, setUsage] = useState<Usage | null | "error">(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    fetchProxy<Usage>("account/usage").then((r) => setUsage(r.ok ? r.data : "error"));
    fetchProxy<Logs>("account/logs", { limit: 25 }).then((r) => {
      if (r.ok) setLogs(r.data.logs ?? []);
    });
    fetch("/api/audit?limit=100")
      .then((r) => r.json())
      .then((b) => setAudit(b.ok ? b.entries : []));
  }, []);

  const usedPct =
    usage && usage !== "error" && usage.calls_limit > 0
      ? (usage.calls_used / usage.calls_limit) * 100
      : 0;

  return (
    <div className="space-y-4">
      {/* Users & roles */}
      <UserManagement />

      {/* API keys — managed in-app, encrypted at rest */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ApiKeySettings provider="ngnmarket" />
        <ApiKeySettings provider="anthropic" />
      </div>

      {/* Quota */}
      <Panel title="API quota" subtitle="Shared monthly account pool">
        {usage === null ? (
          <div className="h-20 animate-pulse rounded bg-stone" />
        ) : usage === "error" ? (
          <p className="py-4 text-center font-sans text-[13px] text-ink/55">
            Quota unavailable (the account/usage endpoint may need a higher plan).
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Calls used" value={formatNumber(usage.calls_used)} />
              <Metric label="Remaining" value={formatNumber(usage.calls_remaining)} />
              <Metric label="Monthly limit" value={formatNumber(usage.calls_limit)} />
              <Metric label="Resets" value={formatDate(usage.reset_at)} />
            </div>
            <div>
              <div className="mb-1 flex justify-between font-sans text-[11px] text-ink/55">
                <span>{usedPct.toFixed(1)}% used</span>
                <span>{formatNumber(usage.calls_remaining)} left</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-stone">
                <div
                  className={`h-full rounded-full ${
                    usedPct > 90 ? "bg-loss" : usedPct > 70 ? "bg-amber-500" : "bg-fresh"
                  }`}
                  style={{ width: `${Math.min(100, usedPct)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  Top endpoints
                </p>
                <ul className="space-y-1">
                  {usage.top_endpoints.slice(0, 6).map((e) => (
                    <li key={e.endpoint} className="flex justify-between font-sans text-[12px]">
                      <span className="truncate text-ink/70">{e.endpoint}</span>
                      <span className="font-semibold tabular-nums text-forest">{e.calls}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  Status breakdown
                </p>
                <ul className="space-y-1">
                  {Object.entries(usage.status_breakdown).map(([k, v]) => (
                    <li key={k} className="flex justify-between font-sans text-[12px]">
                      <span className="text-ink/70">{k}</span>
                      <span className="font-semibold tabular-nums text-forest">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* Audit trail */}
      <Panel
        title="Audit trail"
        subtitle="Analyst actions on portfolios"
        right={
          <CsvExportButton
            rows={audit}
            filename="audit-log"
            columns={[
              { key: "created_at", label: "Timestamp" },
              { key: "actor", label: "Actor" },
              { key: "action", label: "Action" },
              { key: "portfolio_id", label: "Portfolio" },
              { key: "detail", label: "Detail" },
            ]}
          />
        }
      >
        {audit.length === 0 ? (
          <p className="py-4 text-center font-sans text-[13px] text-ink/55">No actions logged yet.</p>
        ) : (
          <div className="max-h-[40vh] overflow-auto">
            <table className="w-full text-left font-sans text-[12px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="py-1.5 pr-2 font-medium">Time</th>
                  <th className="py-1.5 pr-2 font-medium">Actor</th>
                  <th className="py-1.5 pr-2 font-medium">Action</th>
                  <th className="py-1.5 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="py-1.5 pr-2 tabular-nums text-ink/60">{formatTimestamp(a.created_at)}</td>
                    <td className="py-1.5 pr-2 text-ink/70">{a.actor}</td>
                    <td className="py-1.5 pr-2 font-semibold text-forest">{a.action}</td>
                    <td className="py-1.5 truncate text-ink/60">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* API request log */}
      <Panel title="Recent API requests" subtitle="From the NGN Market account log">
        {logs.length === 0 ? (
          <p className="py-4 text-center font-sans text-[13px] text-ink/55">No recent requests.</p>
        ) : (
          <div className="max-h-[40vh] overflow-auto">
            <table className="w-full text-left font-sans text-[12px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="py-1.5 pr-2 font-medium">Time</th>
                  <th className="py-1.5 pr-2 font-medium">Method</th>
                  <th className="py-1.5 pr-2 font-medium">Endpoint</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Status</th>
                  <th className="py-1.5 text-right font-medium">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-1.5 pr-2 tabular-nums text-ink/60">{formatTimestamp(l.timestamp)}</td>
                    <td className="py-1.5 pr-2 text-ink/70">{l.method}</td>
                    <td className="py-1.5 pr-2 truncate text-ink/70">{l.endpoint}</td>
                    <td className={`py-1.5 pr-2 text-right tabular-nums ${l.status_code >= 400 ? "text-loss" : "text-forest-soft"}`}>
                      {l.status_code}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-ink/60">{l.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sand/70 px-3 py-2">
      <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">{label}</p>
      <p className="mt-0.5 font-serif text-base font-semibold text-forest tabular-nums">{value}</p>
    </div>
  );
}
