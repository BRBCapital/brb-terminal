"use client";

import { FileText, ExternalLink } from "lucide-react";
import { useNgx } from "@/hooks/useNgx";
import { Panel, TileBody } from "@/components/ui/Tile";
import { formatTimestamp } from "@/lib/format";
import type { CompanyNews, Paginated, DisclosureRow } from "@/lib/ngx/types";

export function NewsTab({ symbol }: { symbol: string }) {
  const newsQ = useNgx<CompanyNews>(`companies/${symbol}/news`);
  const discQ = useNgx<Paginated<DisclosureRow>>(
    `companies/${symbol}/disclosures`,
    { query: { limit: 25 } }
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Recent news" subtitle="Aggregated headlines">
        <TileBody query={newsQ} isEmpty={(d) => !d?.data?.length}>
          {(d) => (
            <ul className="divide-y divide-stone">
              {d.data.map((n, i) => (
                <li key={n.guid ?? i} className="py-2">
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-2"
                  >
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30 group-hover:text-forest" />
                    <span>
                      <span className="font-sans text-[13px] font-medium text-forest group-hover:underline">
                        {n.title}
                      </span>
                      <span className="mt-0.5 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">
                        {n.source} · {n.time_ago}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </TileBody>
      </Panel>

      <Panel title="Disclosures & filings" subtitle="Official NGX submissions">
        <TileBody query={discQ} isEmpty={(d) => !d?.data?.length}>
          {(payload) => (
            <ul className="divide-y divide-stone">
              {payload.data.map((f, i) => (
                <li key={i} className="py-2">
                  <a
                    href={f.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-2"
                  >
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30 group-hover:text-forest" />
                    <span>
                      <span className="font-sans text-[13px] font-medium capitalize text-forest group-hover:underline">
                        {f.title}
                      </span>
                      <span className="mt-0.5 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">
                        {f.submission_type} · {formatTimestamp(f.disclosed_at)}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </TileBody>
      </Panel>
    </div>
  );
}
