import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ui = fileURLToPath(new URL("..", import.meta.url));
const tokens = resolve(ui, "../design-tokens");
const consumer = mkdtempSync(join(tmpdir(), "khata-package-consumer-"));
function run(command, args, cwd = consumer) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, CI: "true" },
  });
}
try {
  run("pnpm", ["pack", "--out", join(consumer, "ui.tgz")], ui);
  run("pnpm", ["pack", "--out", join(consumer, "tokens.tgz")], tokens);
  run(
    "pnpm",
    ["pack", "--out", join(consumer, "api-client.tgz")],
    resolve(ui, "../api-client"),
  );
  const storybook = JSON.parse(
    readFileSync(resolve(ui, "../../apps/storybook/package.json"), "utf8"),
  );
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      packageManager: "pnpm@11.26.0",
      dependencies: {
        "@khata-club/ui": "file:./ui.tgz",
        "@khata-club/api-client": "file:./api-client.tgz",
        "@khata-club/design-tokens": "file:./tokens.tgz",
        react: "19.3.0",
        "react-dom": "19.3.0",
        tailwindcss: "4.3.3",
        vite: storybook.devDependencies.vite,
        "@tailwindcss/vite": "4.3.3",
      },
    }),
  );
  writeFileSync(
    join(consumer, "pnpm-workspace.yaml"),
    'overrides:\n  "@khata-club/design-tokens": "file:./tokens.tgz"\n',
  );
  run("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile"]);
  const installed = join(consumer, "node_modules/@khata-club/ui");
  assert.equal(
    existsSync(join(installed, "src/components")),
    false,
    "consumer must not have workspace sources",
  );
  assert.deepEqual(
    JSON.parse(readFileSync(join(installed, "package.json"), "utf8"))
      .sideEffects,
    ["**/*.css"],
  );
  writeFileSync(
    join(consumer, "index.html"),
    '<html><body><div id="root"></div><script type="module" src="/main.js"></script></body></html>',
  );
  writeFileSync(
    join(consumer, "main.js"),
    'import React from "react"; import { createRoot } from "react-dom/client"; import { Button, formatAmount } from "@khata-club/ui"; import "./style.css"; if (formatAmount({ value: 9007199254740991 }).exactMajor !== "90071992547409.91") throw new Error("money export"); createRoot(document.getElementById("root")).render(React.createElement(Button, {}, "Continue"));',
  );
  writeFileSync(
    join(consumer, "style.css"),
    '@import "tailwindcss";\n@import "@khata-club/ui/styles.css";',
  );
  writeFileSync(
    join(consumer, "vite.config.js"),
    'import tailwind from "@tailwindcss/vite"; export default { plugins: [tailwind()] };',
  );
  run("pnpm", ["exec", "vite", "build"]);
  writeFileSync(
    join(consumer, "smoke.mjs"),
    'import assert from "node:assert/strict"; import React from "react"; import { renderToStaticMarkup } from "react-dom/server"; import { Amount, Button, formatAmount } from "@khata-club/ui"; assert.equal(formatAmount({ value: 9007199254740991 }).exactMajor, "90071992547409.91"); assert.match(renderToStaticMarkup(React.createElement(Amount, { value: 9007199254740991 })), /value="90071992547409.91"/); assert.match(renderToStaticMarkup(React.createElement(Button, {}, "Continue")), /Continue/);',
  );
  run("node", ["smoke.mjs"]);
  writeFileSync(
    join(consumer, "api-smoke.mjs"),
    'import assert from "node:assert/strict"; import { createApiClient, ResponseValidationError } from "@khata-club/api-client"; const client = createApiClient({ baseUrl: "https://api.example.com", fetch: async () => Response.json({ status: "ok" }) }); assert.deepEqual(await client.health(), { status: "ok" }); const invalid = createApiClient({ baseUrl: "https://api.example.com", fetch: async () => Response.json({ id: "invalid" }) }); await assert.rejects(invalid.me(), ResponseValidationError);',
  );
  run("node", ["api-smoke.mjs"]);
  const assetDir = join(consumer, "dist/assets");
  const css = readdirSync(assetDir)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(assetDir, name), "utf8"))
    .join("\n");
  for (const rule of [".bg-brand", ".h-11", ".focus-ring", "Quicksand"])
    assert.ok(css.includes(rule), `packaged stylesheet is missing ${rule}`);
  console.log(
    "Isolated tarball consumer passes: exports, exact money, runtime dependencies, packaged classes, CSS side effects.",
  );
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
