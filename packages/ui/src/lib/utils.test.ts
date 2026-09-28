import { describe, expect, it } from "vitest";

import { cn } from "./utils";

/**
 * These tests exist because the failure they guard against is silent.
 *
 * tailwind-merge only deduplicates classes it can assign to a group. It
 * ships knowing Tailwind's default scales, so every token this design system
 * adds: `rounded-card`, `text-display-xl`, `duration-base`: is invisible to
 * it until declared in `extendTailwindMerge`. An undeclared token still
 * *renders*; it just stops being overridable, so a caller's `className`
 * loses to the component's own default and nothing anywhere reports a
 * problem.
 *
 * Since "the caller's className wins" is the contract of every component in
 * this package, each custom scale gets a case here.
 */
describe("cn", () => {
  it("lets the last class win within a group", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("keeps classes from different groups", () => {
    expect(cn("p-4", "text-sm")).toBe("p-4 text-sm");
  });

  it("resolves falsy and conditional input", () => {
    expect(cn("p-4", false, null, undefined, ["text-sm"])).toBe("p-4 text-sm");
  });

  describe("custom token scales", () => {
    const cases: Array<[name: string, input: string[], expected: string]> = [
      [
        "radius, custom then stock",
        ["rounded-card", "rounded-full"],
        "rounded-full",
      ],
      [
        "radius, stock then custom",
        ["rounded-full", "rounded-card"],
        "rounded-card",
      ],
      ["font size, fluid display", ["text-display-xl", "text-sm"], "text-sm"],
      ["font size, 2xs", ["text-2xs", "text-base"], "text-base"],
      ["shadow", ["shadow-glass", "shadow-none"], "shadow-none"],
      [
        "shadow, custom then custom",
        ["shadow-raised", "shadow-overlay"],
        "shadow-overlay",
      ],
      [
        "duration, custom then numeric",
        ["duration-base", "duration-200"],
        "duration-200",
      ],
      [
        "duration, numeric then custom",
        ["duration-200", "duration-fast"],
        "duration-fast",
      ],
      ["easing", ["ease-out-quart", "ease-linear"], "ease-linear"],
      ["tracking", ["tracking-display", "tracking-tight"], "tracking-tight"],
      ["z-index, custom then numeric", ["z-modal", "z-10"], "z-10"],
      [
        "backdrop blur",
        ["backdrop-blur-glass", "backdrop-blur-none"],
        "backdrop-blur-none",
      ],
      ["max width", ["max-w-layout", "max-w-md"], "max-w-md"],
    ];

    for (const [name, input, expected] of cases) {
      it(name, () => {
        expect(cn(...input)).toBe(expected);
      });
    }
  });

  describe("semantic colour tokens", () => {
    /* Semantic colour utilities must remain overridable. */
    const cases: Array<[input: string[], expected: string]> = [
      [["bg-surface", "bg-brand"], "bg-brand"],
      [["text-content-primary", "text-danger-fg"], "text-danger-fg"],
      [["border-edge", "border-edge-control"], "border-edge-control"],
      [["bg-success-bg", "bg-warning-bg"], "bg-warning-bg"],
    ];

    for (const [input, expected] of cases) {
      it(input.join(" -> "), () => {
        expect(cn(...input)).toBe(expected);
      });
    }
  });
});
