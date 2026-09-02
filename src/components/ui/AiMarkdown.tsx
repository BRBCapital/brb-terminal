"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Brand-styled markdown for AI-generated content (react-markdown emits no raw
// HTML by default, so model output can't inject markup). remark-gfm parses
// GitHub-flavoured tables — used by statement extractions and portfolio reviews.
export function AiMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 className="mb-1.5 mt-5 flex items-center gap-2 font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest first:mt-0">
            <span className="h-3 w-1 rounded-full bg-fresh" />
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-4 font-sans text-[12px] font-semibold text-forest">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-2 font-sans text-[13.5px] leading-relaxed text-ink/80">{children}</p>
        ),
        ul: ({ children }) => <ul className="mb-2 space-y-1 pl-1">{children}</ul>,
        li: ({ children }) => (
          <li className="flex gap-2 font-sans text-[13.5px] leading-relaxed text-ink/80">
            <span className="mt-px shrink-0 text-fresh">▸</span>
            <span>{children}</span>
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-forest">{children}</strong>
        ),
        em: ({ children }) => <em className="not-italic text-ink/45">{children}</em>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-forest-soft underline">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-left font-sans text-[12.5px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
            {children}
          </thead>
        ),
        tbody: ({ children }) => <tbody className="divide-y divide-stone">{children}</tbody>,
        th: ({ children }) => <th className="py-1.5 pr-3 font-medium">{children}</th>,
        td: ({ children }) => <td className="py-1.5 pr-3 tabular-nums text-ink/80">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
