import { describe, expect, it } from "vitest";

import { findUncheckedForegrounds, getContrastPair } from "./contrast";
import {
  parsePrimitives,
  parseSemanticTokens,
  parseSemantics,
  toHex,
} from "./parse";

const primitives = parsePrimitives(`
  :root {
    --color-light: oklch(100% 0 0);
    --color-dark: oklch(0% 0 0);
  }
`);

describe("parseSemantics", () => {
  it("resolves semantic aliases in both themes", () => {
    const tokens = parseSemantics(
      `
        :root {
          --content-primary: light-dark(var(--color-dark), var(--color-light));
          --amount-neutral: var(--content-primary);
        }
      `,
      primitives,
    );

    expect(
      toHex(tokens.get("--amount-neutral")?.light ?? { r: 1, g: 1, b: 1 }),
    ).toBe("#000000");
    expect(
      toHex(tokens.get("--amount-neutral")?.dark ?? { r: 0, g: 0, b: 0 }),
    ).toBe("#ffffff");
  });

  it("rejects undefined references", () => {
    expect(() =>
      parseSemantics(
        ":root { --surface: color-mix(in oklab, var(--missing), transparent); }",
        primitives,
      ),
    ).toThrow("--surface references an undefined token: --missing");
  });

  it("rejects alias cycles", () => {
    expect(() =>
      parseSemantics(
        ":root { --first: var(--second); --second: var(--first); }",
        primitives,
      ),
    ).toThrow("Token cycle");
  });

  it("keeps backdrop-dependent values available to documentation", () => {
    const css =
      ":root { --surface-glass: color-mix(in oklab, var(--color-light) 60%, transparent); }";
    const resolved = parseSemantics(css, primitives);
    const raw = parseSemanticTokens(css);

    expect(resolved.has("--surface-glass")).toBe(false);
    expect(raw.get("--surface-glass")).toContain("color-mix");
  });
});

describe("contrast coverage", () => {
  it("rejects unresolved checked colours", () => {
    expect(() =>
      getContrastPair(new Map(), "--amount-neutral", "--surface"),
    ).toThrow("Unresolved contrast pair: --amount-neutral on --surface");
  });

  it("requires semantic foreground aliases to be checked", () => {
    expect(findUncheckedForegrounds(["--amount-neutral"])).toEqual([]);
    expect(findUncheckedForegrounds(["--content-new"])).toEqual([
      "--content-new",
    ]);
    expect(findUncheckedForegrounds(["--color-content-new"])).toEqual([]);
  });
});
