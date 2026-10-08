import { readFileSync } from "node:fs";
import ts from "typescript-api";

export function styleViolations(source, semanticNames) {
  const failures = [];
  const ast = ts.createSourceFile(
    "component.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const colors =
    /^(?:bg|text|border|ring|outline|fill|stroke|decoration|placeholder|accent|caret|divide)-(.*)$/;
  const sizes =
    /^(?:h|w|min-h|max-h|min-w|max-w|size|p[trblxyse]?|m[trblxyse]?|gap(?:-[xy])?|space-[xy]|top|right|bottom|left|inset(?:-[xy])?)-\d+\.\d+$/;
  function check(word) {
    // Colons inside arbitrary selectors are not variant separators.
    let depth = 0;
    let start = 0;
    for (let i = 0; i < word.length; i++) {
      if (word[i] === "[") depth++;
      if (word[i] === "]") depth--;
      if (word[i] === ":" && depth === 0) start = i + 1;
    }
    const utility = word.slice(start).replace(/^-/, "");
    if (
      /^(font-(mono|serif)|dark:)/.test(word) ||
      utility === "font-mono" ||
      utility === "font-serif"
    )
      failures.push(word);
    if (
      /^font-/.test(utility) &&
      !/^font-(?:sans|display|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(
        utility,
      )
    )
      failures.push(word);
    if (sizes.test(utility)) failures.push(word);
    if (/-\[/.test(utility) && !/^transition-\[[a-z,-]+\]$/.test(utility))
      failures.push(word);
    const color = colors.exec(utility)?.[1];
    if (
      color &&
      /^(?:neutral|brand|success|warning|danger|info|red|blue|green|gray|slate|zinc|stone|amber|yellow|orange|purple|pink|indigo|violet|cyan|teal|emerald|lime|rose|fuchsia|sky)-\d/.test(
        color,
      )
    )
      failures.push(word);
    if (color) {
      const name = color.split("/")[0];
      const structural =
        /^(?:xs|sm|base|lg|xl|[2-9]xl|left|right|center|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|solid|dashed|dotted|double|hidden|none|collapse|separate|inset|offset-\d+|[trblxyse](?:-\d+)?|\d+|auto|cover|contain|fixed|local|scroll|repeat(?:-[xy])?|no-repeat|top|bottom|current|transparent|inherit)$/;
      const variable = /^\(--[a-z][\w-]*\)$/.test(name);
      if (!semanticNames.has(name) && !structural.test(name) && !variable)
        failures.push(word);
      if (variable && /-\d+\)$/.test(name)) failures.push(word);
    }
  }
  function visit(node) {
    if (
      ts.isStringLiteralLike(node) &&
      !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)
    )
      for (const word of node.text.split(/\s+/)) check(word);
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "style") {
      const text = node.initializer?.getText(ast) ?? "";
      const strings = [];
      let hardcoded = false;
      function inspect(value) {
        if (ts.isStringLiteralLike(value)) strings.push(value.text);
        if (ts.isNumericLiteral(value) && value.text !== "0") hardcoded = true;
        ts.forEachChild(value, inspect);
      }
      if (node.initializer) inspect(node.initializer);
      if (
        !text.includes("var(--") ||
        hardcoded ||
        strings.some((value) => !/^var\(--[\w-]+\)$/.test(value))
      )
        failures.push("inline style must reference a token");
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /khata-core|service-role|server-only/.test(node.moduleSpecifier.text)
    )
      failures.push("private server import");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...new Set(failures)];
}

export function semanticColorNames(css) {
  return new Set(
    [...css.matchAll(/--(?:color|text)-([\w-]+)\s*:/g)].map(
      (match) => match[1],
    ),
  );
}

export function checkSource(file, semantics) {
  const errors = styleViolations(readFileSync(file, "utf8"), semantics);
  return errors.map((error) => `${file}: ${error}`);
}
