/**
 * Contrast gate.
 * Run: pnpm --filter @khata-club/design-tokens check-contrast
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  contrast,
  parsePrimitives,
  parseSemantics,
  toHex,
} from "../src/parse.ts";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (file: string) => readFileSync(join(src, file), "utf8");

/* ---------------------------------------------------------------------------
 * The contract
 *
 * Each entry is a promise the design system makes to anyone composing with
 * it: "this foreground is legible on this background". Adding a semantic
 * foreground without adding it here is the failure mode this file exists to
 * catch, so anything unlisted and unexempted is reported at the end.
 * ------------------------------------------------------------------------ */

type Pair = { fg: string; bg: string; min?: number; note?: string };

/** WCAG 2.2: 4.5:1 for body text, 3:1 for large text and UI boundaries. */
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

const pairs: Pair[] = [
  // Body text, on every surface it can land on.
  { fg: "--content-primary", bg: "--canvas" },
  { fg: "--content-primary", bg: "--surface" },
  { fg: "--content-primary", bg: "--surface-raised" },
  { fg: "--content-primary", bg: "--surface-sunken" },
  { fg: "--content-secondary", bg: "--canvas" },
  { fg: "--content-secondary", bg: "--surface" },
  { fg: "--content-secondary", bg: "--surface-raised" },
  { fg: "--content-secondary", bg: "--surface-sunken" },
  { fg: "--content-muted", bg: "--canvas" },
  { fg: "--content-muted", bg: "--surface" },
  { fg: "--content-muted", bg: "--surface-sunken" },
  { fg: "--content-inverse", bg: "--surface-inverse" },
  { fg: "--content-brand", bg: "--canvas" },
  { fg: "--content-brand", bg: "--surface" },
  { fg: "--content-brand", bg: "--brand-subtle" },

  // Filled controls: the label against its own fill, in every state. Hover
  // and active are included because dark mode lightens them, and a label
  // that passes at rest can fail once the pointer is over it.
  { fg: "--on-brand", bg: "--brand" },
  { fg: "--on-brand", bg: "--brand-hover" },
  { fg: "--on-brand", bg: "--brand-active" },

  // Status text on its soft background. Badge, callout, inline validation.
  { fg: "--success-fg", bg: "--success-bg" },
  { fg: "--warning-fg", bg: "--warning-bg" },
  { fg: "--danger-fg", bg: "--danger-bg" },
  { fg: "--info-fg", bg: "--info-bg" },

  // The same text on a plain surface, where form errors render.
  { fg: "--success-fg", bg: "--surface" },
  { fg: "--warning-fg", bg: "--surface" },
  { fg: "--danger-fg", bg: "--surface" },
  { fg: "--info-fg", bg: "--surface" },

  // Solid status fills.
  { fg: "--on-success", bg: "--success" },
  { fg: "--on-warning", bg: "--warning" },
  { fg: "--on-danger", bg: "--danger" },
  { fg: "--on-info", bg: "--info" },

  // Money. Rendered small and dense in tables, so held to the text bar.
  { fg: "--amount-positive", bg: "--surface" },
  { fg: "--amount-negative", bg: "--surface" },
  { fg: "--amount-positive", bg: "--surface-sunken" },
  { fg: "--amount-negative", bg: "--surface-sunken" },

  // Non-text. WCAG 1.4.11 and 2.4.11 ask for 3:1 against adjacent colour,
  // not 4.5:1. Only borders that *are* the affordance appear here. See the
  // `edge-control` comment in semantic.css, and `exempt` below, for why the
  // decorative edges do not.
  {
    fg: "--edge-control",
    bg: "--surface",
    min: AA_NON_TEXT,
    note: "1.4.11 — input/checkbox/select boundary",
  },
  {
    fg: "--edge-control",
    bg: "--surface-sunken",
    min: AA_NON_TEXT,
    note: "1.4.11 — control on a sunken surface",
  },
  {
    fg: "--brand",
    bg: "--canvas",
    min: AA_NON_TEXT,
    note: "2.4.11 — focus indicator",
  },
  {
    fg: "--brand",
    bg: "--surface",
    min: AA_NON_TEXT,
    note: "2.4.11 — focus indicator",
  },
];

/**
 * Foregrounds deliberately outside the gate, each with its reason. An
 * exemption without a reason is how a palette rots, so the list is printed
 * on every run rather than hidden in a config.
 */
const exempt: Record<string, string> = {
  "--content-subtle":
    "disabled / inactive text only; WCAG 1.4.3 exempts inactive controls. Placeholders use --content-muted",
  "--color-accent-decorative":
    "9px ornamental dot, never text or a meaningful graphic (2.63:1 on white)",
  "--edge-subtle":
    "decorative divider; 1.4.11 covers borders that identify a component, not rules between rows",
  "--edge":
    "decorative card/table outline; the surface and shadow identify the component, not this line",
  "--edge-strong":
    "decorative emphasis outline; interactive boundaries use --edge-control, gated at 3:1 above",
  "--edge-glass":
    "translucent; effective contrast depends on the backdrop behind it",
};

/* ---------------------------------------------------------------------------
 * Run
 * ------------------------------------------------------------------------ */

const primitives = parsePrimitives(read("primitives.css"));
const semantics = parseSemantics(read("semantic.css"), primitives);

let failures = 0;
const lines: string[] = [];

for (const theme of ["light", "dark"] as const) {
  lines.push(`\n  ${theme.toUpperCase()}`);

  for (const { fg, bg, min = AA_TEXT, note } of pairs) {
    const f = semantics.get(fg);
    const b = semantics.get(bg);
    if (!f || !b) throw new Error(`Unknown token in pair: ${fg} on ${bg}`);

    const ratio = contrast(f[theme], b[theme]);
    const pass = ratio >= min;
    if (!pass) failures++;

    lines.push(
      [
        pass ? "  ok  " : "  FAIL",
        ratio.toFixed(2).padStart(6),
        `(min ${min})`.padEnd(10),
        `${fg} on ${bg}`.padEnd(46),
        `${toHex(f[theme])} / ${toHex(b[theme])}`,
        note ? `  — ${note}` : "",
      ].join(" "),
    );
  }
}

console.log(lines.join("\n"));

/* Any semantic foreground that is neither checked nor exempt is an untested
 * promise, and is treated as a failure. */
const checked = new Set(pairs.map((p) => p.fg));
const unchecked = [...semantics.keys()].filter(
  (name) =>
    (name.startsWith("--content-") ||
      name.startsWith("--on-") ||
      name.startsWith("--edge") ||
      name.startsWith("--amount-") ||
      name.endsWith("-fg")) &&
    !checked.has(name) &&
    !(name in exempt),
);

if (unchecked.length > 0) {
  const list = unchecked.map((name) => `    ${name}`).join("\n");
  console.error(
    `\n  ${unchecked.length} foreground token(s) neither checked nor exempt:\n${list}\n  Add a pair above, or an entry to \`exempt\` with a reason.`,
  );
  failures += unchecked.length;
}

const exemptions = Object.entries(exempt)
  .map(([name, why]) => `    ${name.padEnd(28)} ${why}`)
  .join("\n");
console.log(`\n  Exempt by design:\n${exemptions}`);

if (failures > 0) {
  console.error(`\n  ${failures} contrast failure(s).\n`);
  process.exit(1);
}

console.log(`\n  All ${pairs.length * 2} pairs pass in both themes.\n`);
