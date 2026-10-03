import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checkSource, semanticColorNames } from "./design-rules.mjs";

const colors = semanticColorNames(
  readFileSync("packages/design-tokens/src/semantic.css", "utf8") +
    [
      ...readFileSync(
        "packages/design-tokens/src/primitives.css",
        "utf8",
      ).matchAll(/--text-[\w-]+\s*:/g),
    ]
      .map((match) => match[0])
      .join("\n"),
);
function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    return entry.isDirectory()
      ? sources(file)
      : /\.tsx?$/.test(file)
        ? [file]
        : [];
  });
}
const errors = sources("packages/ui/src").flatMap((file) =>
  checkSource(file, colors),
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else console.log("Design-system source rules pass.");
