"use client";

import { useState, type RefObject } from "react";
import { Download, Image as ImageIcon } from "lucide-react";
import { downloadCsv, type CsvColumn } from "@/lib/export/csv";
import { downloadSvgAsPng } from "@/lib/export/png";

const BTN =
  "inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest-soft hover:bg-sand disabled:opacity-40";

export function CsvExportButton<T>({
  rows,
  columns,
  filename,
  label = "CSV",
}: {
  rows: T[];
  columns: CsvColumn<T>[];
  filename: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={BTN}
      disabled={!rows.length}
      onClick={() => downloadCsv(filename, rows, columns)}
      title="Download as CSV"
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export function PngExportButton({
  targetRef,
  filename,
  label = "PNG",
}: {
  targetRef: RefObject<HTMLElement>;
  filename: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={BTN}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadSvgAsPng(targetRef.current, filename);
        } finally {
          setBusy(false);
        }
      }}
      title="Download chart as PNG"
    >
      <ImageIcon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
