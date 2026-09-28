import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AA_TEXT,
  contrastExemptions,
  contrastPairs,
  findUncheckedForegrounds,
  getContrastPair,
} from "../src/contrast.ts";
import {
  contrast,
  declarations,
  parsePrimitives,
  parseSemanticTokens,
  parseSemantics,
  toHex,
} from "../src/parse.ts";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (file: string) => readFileSync(join(src, file), "utf8");
const primitiveCss = read("primitives.css");
const primitives = parsePrimitives(primitiveCss);
const semanticCss = read("semantic.css");
const semantics = parseSemantics(
  semanticCss,
  primitives,
  declarations(primitiveCss).map(([name]) => name),
);

let failures = 0;
const lines: string[] = [];

for (const theme of ["light", "dark"] as const) {
  lines.push(`\n  ${theme.toUpperCase()}`);

  for (const { fg, bg, min = AA_TEXT, note } of contrastPairs) {
    const [foreground, background] = getContrastPair(semantics, fg, bg);

    const ratio = contrast(foreground[theme], background[theme]);
    const pass = ratio >= min;
    if (!pass) failures++;

    lines.push(
      [
        pass ? "  ok  " : "  FAIL",
        ratio.toFixed(2).padStart(6),
        `(min ${min})`.padEnd(10),
        `${fg} on ${bg}`.padEnd(46),
        `${toHex(foreground[theme])} / ${toHex(background[theme])}`,
        note ? `  ${note}` : "",
      ].join(" "),
    );
  }
}

console.log(lines.join("\n"));

const unchecked = findUncheckedForegrounds(
  parseSemanticTokens(semanticCss).keys(),
);
if (unchecked.length > 0) {
  console.error(
    `\n  Unchecked foreground tokens:\n${unchecked.map((name) => `    ${name}`).join("\n")}`,
  );
  failures += unchecked.length;
}

const exemptions = Object.entries(contrastExemptions)
  .map(([name, reason]) => `    ${name.padEnd(28)} ${reason}`)
  .join("\n");
console.log(`\n  Exempt by design:\n${exemptions}`);

if (failures > 0) {
  console.error(`\n  ${failures} contrast failure(s).\n`);
  process.exit(1);
}

console.log(`\n  All ${contrastPairs.length * 2} checks pass.\n`);
