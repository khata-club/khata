import { readFileSync, writeFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import openapiTS, { astToString } from "openapi-typescript";

const snapshot = new URL("../openapi.json", import.meta.url);
const document = JSON.parse(readFileSync(snapshot, "utf8"));
const allowed = ["/healthz", "/readyz", "/v1/me"];
if (
  document.openapi !== "3.1.0" ||
  Object.keys(document.paths).some((path) => !allowed.includes(path))
)
  throw new Error(
    "Review the public route allowlist before exporting more contracts",
  );
const banner =
  "// Generated from the reviewed public snapshot. Run pnpm generate.\n";
writeFileSync(
  new URL("../src/generated/schema.ts", import.meta.url),
  banner + astToString(await openapiTS(snapshot)),
);
const ajv = new Ajv2020({
  strict: true,
  code: { source: true, esm: true },
  allErrors: false,
});
ajv.addFormat(
  "uuid",
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i,
);
// Resolve only the public component schemas; server code is never available here.
const definitions = JSON.parse(
  JSON.stringify(document.components.schemas).replaceAll(
    "#/components/schemas/",
    "#/$defs/",
  ),
);
ajv.addSchema({ $id: "khata-public", $defs: definitions });
const exports = {};
for (const name of ["Status", "Identity", "Failure"]) {
  const id = `khata-public-${name}`;
  ajv.addSchema({ $id: id, $ref: `khata-public#/$defs/${name}` });
  exports[`validate${name}`] = id;
}
writeFileSync(
  new URL("../src/generated/validators.js", import.meta.url),
  banner + standaloneCode(ajv, exports),
);
writeFileSync(
  new URL("../src/generated/validators.d.ts", import.meta.url),
  `${banner}import type { components } from "./schema.js";\n${Object.keys(
    exports,
  )
    .map(
      (name) =>
        `export declare function ${name}(value: unknown): value is components["schemas"]["${name.slice(8)}"];`,
    )
    .join("\n")}\n`,
);
