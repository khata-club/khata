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

describe("exact money boundaries", () => {
  it.each([
    0,
    -0,
    1,
    -1,
    Number.MAX_SAFE_INTEGER,
    -Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER - 1,
    Number.MAX_SAFE_INTEGER - 2,
  ])("preserves every minor unit of %s", (value) => {
    const { exactMajor, formatted } = formatAmount({ value, locale: "en-US" });
    const magnitude = BigInt(Math.abs(value));
    const expected = `${value < 0 ? "-" : ""}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, "0")}`;
    expect(exactMajor).toBe(expected);
    expect(formatted.replace(/[^0-9.]/g, "")).toBe(expected.replace("-", ""));
  });
  it.each(["JPY", "KWD", "INR"])(
    "retains exact %s values through lossy display options",
    (currency) => {
      const exact = formatAmount({
        value: Number.MAX_SAFE_INTEGER,
        currency,
      }).exactMajor;
      expect(
        formatAmount({
          value: Number.MAX_SAFE_INTEGER,
          currency,
          compact: true,
        }).exactMajor,
      ).toBe(exact);
      expect(
        formatAmount({
          value: Number.MAX_SAFE_INTEGER,
          currency,
          hideFraction: true,
        }).exactMajor,
      ).toBe(exact);
    },
  );
  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    0.1,
    Number.MIN_SAFE_INTEGER - 1,
  ])("rejects %s", (value) => {
    expect(() => formatAmount({ value })).toThrow(RangeError);
  });
});
