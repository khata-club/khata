import type { Rgb, Theme } from "./parse";

export type ContrastPair = {
  fg: string;
  bg: string;
  min?: number;
  note?: string;
};

export const AA_TEXT = 4.5;
export const AA_NON_TEXT = 3;

export const contrastPairs: ContrastPair[] = [
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
  { fg: "--on-brand", bg: "--brand" },
  { fg: "--on-brand", bg: "--brand-hover" },
  { fg: "--on-brand", bg: "--brand-active" },
  { fg: "--success-fg", bg: "--success-bg" },
  { fg: "--warning-fg", bg: "--warning-bg" },
  { fg: "--danger-fg", bg: "--danger-bg" },
  { fg: "--info-fg", bg: "--info-bg" },
  { fg: "--success-fg", bg: "--surface" },
  { fg: "--warning-fg", bg: "--surface" },
  { fg: "--danger-fg", bg: "--surface" },
  { fg: "--info-fg", bg: "--surface" },
  { fg: "--on-success", bg: "--success" },
  { fg: "--on-warning", bg: "--warning" },
  { fg: "--on-danger", bg: "--danger" },
  { fg: "--on-info", bg: "--info" },
  { fg: "--amount-positive", bg: "--surface" },
  { fg: "--amount-negative", bg: "--surface" },
  { fg: "--amount-neutral", bg: "--surface" },
  { fg: "--amount-positive", bg: "--surface-sunken" },
  { fg: "--amount-negative", bg: "--surface-sunken" },
  { fg: "--amount-neutral", bg: "--surface-sunken" },
  {
    fg: "--edge-control",
    bg: "--surface",
    min: AA_NON_TEXT,
    note: "1.4.11, control boundary",
  },
  {
    fg: "--edge-control",
    bg: "--surface-sunken",
    min: AA_NON_TEXT,
    note: "1.4.11, control on a sunken surface",
  },
  {
    fg: "--brand",
    bg: "--canvas",
    min: AA_NON_TEXT,
    note: "2.4.11, focus indicator",
  },
  {
    fg: "--brand",
    bg: "--surface",
    min: AA_NON_TEXT,
    note: "2.4.11, focus indicator",
  },
];

export const contrastExemptions: Record<string, string> = {
  "--content-subtle": "inactive text; WCAG 1.4.3 exempts inactive controls",
  "--color-accent-decorative":
    "ornamental only; never text or a meaningful graphic",
  "--edge-subtle": "decorative divider",
  "--edge": "decorative card and table outline",
  "--edge-strong": "decorative emphasis outline",
  "--edge-glass": "translucent; contrast depends on its backdrop",
  "--ring": "translucent; contrast depends on its backdrop",
};

export function getContrastPair(
  semantics: ReadonlyMap<string, Record<Theme, Rgb>>,
  fg: string,
  bg: string,
): [Record<Theme, Rgb>, Record<Theme, Rgb>] {
  const foreground = semantics.get(fg);
  const background = semantics.get(bg);
  if (!foreground || !background) {
    throw new Error(`Unresolved contrast pair: ${fg} on ${bg}`);
  }
  return [foreground, background];
}

export function isForegroundToken(name: string): boolean {
  if (name.startsWith("--color-")) return false;
  return (
    name.startsWith("--content-") ||
    name.startsWith("--on-") ||
    name.startsWith("--edge") ||
    name.startsWith("--amount-") ||
    name === "--ring" ||
    name.endsWith("-fg")
  );
}

export function findUncheckedForegrounds(names: Iterable<string>): string[] {
  const checked = new Set(contrastPairs.map(({ fg }) => fg));
  return [...names].filter(
    (name) =>
      isForegroundToken(name) &&
      !checked.has(name) &&
      !(name in contrastExemptions),
  );
}
