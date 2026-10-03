import assert from "node:assert/strict";
import test from "node:test";
import { boundaryViolations } from "./public-boundary.mjs";

test("rejects private imports through static, dynamic, CommonJS, and re-export paths", () => {
  for (const source of [
    'import x from "../khata-core/server"',
    'const x = import("@khata-core/api")',
    'const x = require("server-only")',
    'export { x } from "khata-core/internal"',
  ])
    assert.ok(boundaryViolations(source).length);
});
test("rejects privileged client configuration and credentials", () => {
  assert.ok(boundaryViolations("const key = SUPABASE_SERVICE_ROLE_KEY").length);
  const payload = Buffer.from(
    JSON.stringify({ role: "service_role" }),
  ).toString("base64url");
  assert.ok(
    boundaryViolations(
      `const key = "eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic"`,
    ).length,
  );
});
test("accepts reviewed public clients and synthetic examples", () => {
  assert.deepEqual(
    boundaryViolations(
      'import { createApiClient } from "@khata-club/api-client"; const example = { id: "synthetic" }',
    ),
    [],
  );
});
