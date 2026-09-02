// Dependency-free CSV export. Runs in the browser; triggers a file download.

export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  // Optional formatter for the cell value.
  format?: (row: T) => string | number | null | undefined;
}

// Interfaces (without index signatures) don't satisfy Record<string, unknown>,
// so keep T unconstrained and read cells through a loose cast.
type AnyRow = Record<string, unknown>;

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  // Quote if it contains comma, quote, or newline.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = c.format ? c.format(row) : (row as AnyRow)[c.key as string];
          return escapeCell(raw);
        })
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[]
): void {
  const csv = toCsv(rows, columns);
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
