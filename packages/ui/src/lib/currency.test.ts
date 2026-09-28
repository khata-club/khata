import { describe, expect, it } from "vitest";

import { formatAmount, minorUnits } from "./currency";

describe("minorUnits", () => {
  it("defaults to 100", () => {
    expect(minorUnits("INR")).toBe(100);
    expect(minorUnits("USD")).toBe(100);
  });

  it("knows the currencies that are not 100", () => {
    expect(minorUnits("JPY")).toBe(1);
    expect(minorUnits("KWD")).toBe(1000);
  });

  it("is case insensitive", () => {
    expect(minorUnits("inr")).toBe(100);
  });

  it("rejects an unknown code", () => {
    expect(() => minorUnits("XYZ")).toThrow("Unsupported currency");
  });
});

describe("formatAmount", () => {
  it("converts paise to rupees", () => {
    const { formatted, major } = formatAmount({ value: 125000 });
    expect(major).toBe(1250);
    expect(formatted).toContain("1,250.00");
  });

  it("groups Indian-style, not Western", () => {
    const { formatted } = formatAmount({ value: 12_000_000 });
    expect(formatted).toContain("1,20,000");
    expect(formatted).not.toContain("120,000");
  });

  it("uses lakh compact notation under an Indian locale", () => {
    const { formatted } = formatAmount({ value: 12_000_000, compact: true });
    expect(formatted).toMatch(/1\.2\s?L/);
  });

  it("compacts to K under a US locale", () => {
    const { formatted } = formatAmount({
      value: 12_000_000,
      currency: "USD",
      locale: "en-US",
      compact: true,
    });
    expect(formatted).toMatch(/120K/);
  });

  it("keeps the exact value when the display is compacted", () => {
    const { major, formatted } = formatAmount({
      value: 12_345_678,
      compact: true,
    });
    expect(major).toBe(123456.78);
    expect(formatted).not.toContain("123456.78");
  });

  it("respects a currency with no subunit", () => {
    const { major, formatted } = formatAmount({
      value: 500,
      currency: "JPY",
      locale: "ja-JP",
    });
    expect(major).toBe(500);
    expect(formatted).toContain("500");
  });

  it("respects a currency with three decimal places", () => {
    const { major, formatted } = formatAmount({
      value: 1500,
      currency: "KWD",
      locale: "en-US",
    });
    expect(major).toBe(1.5);
    expect(formatted).toContain("1.500");
  });

  it("uses U+2212 for negatives, not a hyphen", () => {
    const { sign, negative } = formatAmount({ value: -1 });
    expect(negative).toBe(true);
    expect(sign).toBe("−");
    expect(sign).not.toBe("-");
  });

  it("strips the sign from the formatted string", () => {
    const { formatted } = formatAmount({ value: -125000 });
    expect(formatted).not.toContain("-");
    expect(formatted).not.toContain("−");
  });

  it("only shows a plus when asked", () => {
    expect(formatAmount({ value: 100 }).sign).toBe("");
    expect(formatAmount({ value: 100, signed: true }).sign).toBe("+");
  });

  it("never signs zero as negative", () => {
    const { sign, negative } = formatAmount({ value: 0, signed: true });
    expect(negative).toBe(false);
    expect(sign).toBe("");
  });

  it("rejects non-integer and unsafe values", () => {
    expect(() => formatAmount({ value: 1.5 })).toThrow("safe integer");
    expect(() => formatAmount({ value: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
      "safe integer",
    );
  });

  it("drops the fraction on request", () => {
    const { formatted } = formatAmount({ value: 125050, hideFraction: true });
    expect(formatted).toContain("1,251");
    expect(formatted).not.toContain(".");
  });
});
