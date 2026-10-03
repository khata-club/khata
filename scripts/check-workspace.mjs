import { existsSync, readFileSync, readdirSync } from "node:fs";

const inventory = JSON.parse(readFileSync("workspace-status.json", "utf8"));
const paths = ["apps", "packages"]
  .flatMap((dir) => readdirSync(dir).map((name) => `${dir}/${name}`))
  .filter((dir) => existsSync(`${dir}/package.json`));
if (
  JSON.stringify(paths.sort()) !== JSON.stringify(Object.keys(inventory).sort())
)
  throw new Error("Workspace inventory must list every package exactly once");
for (const path of paths) {
  const pkg = JSON.parse(readFileSync(`${path}/package.json`, "utf8"));
  const entry = inventory[path];
  if (!["active", "scaffold"].includes(entry.status) || !entry.reason)
    throw new Error(`Invalid inventory: ${path}`);
  const checks =
    entry.status === "active"
      ? [
          "lint",
          "typecheck",
          "test",
          ...(entry.build === "source-css" ? [] : ["build"]),
        ]
      : ["lint"];
  for (const check of checks)
    if (!pkg.scripts?.[check] || /^echo\b/.test(pkg.scripts[check]))
      throw new Error(`${path} needs a real ${check} check`);
  if (!pkg.private)
    throw new Error(
      `${path} must remain private until distribution is authorized`,
    );
  console.log(`${path}: ${entry.status} — ${entry.reason}`);
}
