import { describe, it, expect } from "vitest";
import {
  formatNaira,
  formatNairaCompact,
  formatPercent,
  changeTone,
  formatNumber,
} from "./format";

describe("formatNaira", () => {
  it("formats with the naira sign, grouping and 2 decimals", () => {
    expect(formatNaira(1234.5)).toBe("₦1,234.50");
  });
  it("returns an em dash for null/NaN", () => {
    expect(formatNaira(null)).toBe("—");
    expect(formatNaira(undefined)).toBe("—");
  });
});

describe("formatNairaCompact", () => {
  it("uses T / B / M / K suffixes", () => {
    expect(formatNairaCompact(4.87e12)).toBe("₦4.87T");
    expect(formatNairaCompact(1.56e9)).toBe("₦1.56B");
    expect(formatNairaCompact(487.29e6)).toBe("₦487.29M");
    expect(formatNairaCompact(-2.5e9)).toBe("-₦2.50B");
  });
});

describe("formatPercent", () => {
  it("prefixes a + for positive and keeps - for negative", () => {
    expect(formatPercent(0.84)).toBe("+0.84%");
    expect(formatPercent(-9.8)).toBe("-9.80%");
    expect(formatPercent(0)).toBe("0.00%");
  });
});

describe("changeTone", () => {
  it("classifies up / down / flat", () => {
    expect(changeTone(1)).toBe("up");
    expect(changeTone(-1)).toBe("down");
    expect(changeTone(0)).toBe("flat");
    expect(changeTone(null)).toBe("flat");
  });
});

describe("formatNumber", () => {
  it("groups thousands with configurable decimals", () => {
    expect(formatNumber(243902.6, 2)).toBe("243,902.60");
    expect(formatNumber(44705)).toBe("44,705");
  });
});
