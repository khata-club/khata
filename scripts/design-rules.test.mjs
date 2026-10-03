import assert from "node:assert/strict";
import test from "node:test";
import { styleViolations } from "./design-rules.mjs";

const colors = new Set(["surface", "content-primary", "brand", "edge"]);
test("rejects hardcoded colors, arbitrary values, forbidden fonts and off-grid spacing", () => {
  for (const utility of [
    "bg-neutral-0",
    "bg-unreviewed",
    "text-made-up",
    "hover:text-red-500",
    "fill-white",
    "h-[45px]",
    "bg-[red]",
    "font-mono",
    "p-2.5",
    "dark:bg-surface",
  ]) {
    assert.ok(
      styleViolations(`const classes = "${utility}"`, colors).includes(utility),
      utility,
    );
  }
});
test("permits tokens, CSS variable sizes, state variants and selector utilities", () => {
  const source =
    'const classes = "bg-surface text-content-primary focus-ring h-11 max-h-(--dialog-max-height) data-[state=checked]:bg-brand [&_tr]:border-edge transition-[border-color,box-shadow]"';
  assert.deepEqual(styleViolations(source, colors), []);
});
test("checks inline styling and private imports", () => {
  assert.ok(
    styleViolations('const node = <div style={{ color: "#ffffff" }} />', colors)
      .length,
  );
  assert.ok(
    styleViolations(
      'const node = <div style={{ color: "var(--content-primary)", width: 13 }} />',
      colors,
    ).length,
  );
  assert.ok(
    styleViolations('import x from "khata-core/server"', colors).length,
  );
  assert.deepEqual(
    styleViolations(
      'const node = <div style={{ color: "var(--content-primary)" }} />',
      colors,
    ),
    [],
  );
});
