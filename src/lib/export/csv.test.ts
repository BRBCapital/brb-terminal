import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

interface Row {
  symbol: string;
  name: string;
  price: number | null;
}

describe("toCsv", () => {
  const rows: Row[] = [
    { symbol: "DANGCEM", name: "Dangote Cement", price: 1047 },
    { symbol: "GTCO", name: "Guaranty, Trust", price: null },
  ];
  const columns = [
    { key: "symbol" as const, label: "Symbol" },
    { key: "name" as const, label: "Company" },
    { key: "price" as const, label: "Price" },
  ];

  it("emits a header row from labels", () => {
    const csv = toCsv(rows, columns);
    expect(csv.split("\n")[0]).toBe("Symbol,Company,Price");
  });

  it("quotes cells containing commas", () => {
    const csv = toCsv(rows, columns);
    expect(csv).toContain('"Guaranty, Trust"');
  });

  it("renders null as an empty cell", () => {
    const line = toCsv([rows[1]], columns).split("\n")[1];
    expect(line).toBe('GTCO,"Guaranty, Trust",');
  });

  it("escapes embedded quotes by doubling them", () => {
    const csv = toCsv([{ symbol: 'A"B', name: "x", price: 1 }], columns);
    expect(csv).toContain('"A""B"');
  });

  it("supports a custom formatter", () => {
    const csv = toCsv(rows, [
      { key: "price", label: "Price", format: (r: Row) => (r.price == null ? "n/a" : r.price.toFixed(1)) },
    ]);
    expect(csv.split("\n")).toEqual(["Price", "1047.0", "n/a"]);
  });
});
