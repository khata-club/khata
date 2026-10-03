import ts from "typescript-api";

export function boundaryViolations(source) {
  const failures = new Set();
  const ast = ts.createSourceFile(
    "public.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function moduleName(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      return node.moduleSpecifier.text;
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      return node.arguments[0].text;
    return undefined;
  }
  function visit(node) {
    const name = moduleName(node);
    if (name && /khata-core|@khata-core|server-only|service-role/.test(name))
      failures.add("private implementation import");
    if (
      ts.isIdentifier(node) &&
      /^(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|DATABASE_PASSWORD)$/.test(
        node.text,
      )
    )
      failures.add("privileged server configuration");
    if (ts.isStringLiteralLike(node)) {
      if (/\bsb_secret_[\w-]{20,}/.test(node.text))
        failures.add("privileged Supabase key");
      for (const jwt of node.text.matchAll(/\beyJ[\w-]+\.([\w-]+)\.[\w-]+/g)) {
        try {
          if (
            JSON.parse(Buffer.from(jwt[1], "base64url").toString()).role ===
            "service_role"
          )
            failures.add("privileged Supabase JWT");
        } catch {
          /* Secret scanning also covers opaque credentials. */
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...failures];
}
