import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { boundaryViolations } from "./public-boundary.mjs";

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", ".turbo", "coverage", ".git"].includes(entry.name))
      return [];
    const file = join(dir, entry.name);
    return entry.isDirectory()
      ? sources(file)
      : /\.(?:[cm]?[jt]sx?|json)$/.test(file)
        ? [file]
        : [];
  });
}
const errors = ["apps", "packages"]
  .flatMap(sources)
  .flatMap((file) =>
    boundaryViolations(readFileSync(file, "utf8")).map(
      (error) => `${file}: ${error}`,
    ),
  );
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Public source and emitted JavaScript contain no private imports or known privileged credential forms.",
  );
