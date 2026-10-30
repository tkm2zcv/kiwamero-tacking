import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

test("report contracts, pure processors and progress UI have no server-runtime dependencies", () => {
  const visited = new Set<string>();
  const server = new Set([
    "db.ts", "auth.ts", "henrikdev.ts", "henrik-client.ts", "henrik-request.ts",
    "henrik-quota.ts", "audit-history.ts", "audit-run.ts", "match-archive.ts",
  ]);
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(!server.has(path.basename(file)), `Server module reached: ${file}`);
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const dependencies: string[] = [];
    function scan(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (clause?.isTypeOnly) return;
        if (!clause?.name && clause?.namedBindings && ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.length && clause.namedBindings.elements.every((e) => e.isTypeOnly)) return;
        dependencies.push((node.moduleSpecifier as ts.StringLiteral).text);
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        if (node.isTypeOnly) return;
        if (node.exportClause && ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.length && node.exportClause.elements.every((e) => e.isTypeOnly)) return;
        dependencies.push((node.moduleSpecifier as ts.StringLiteral).text);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        dependencies.push(node.arguments[0].text);
      } else if (ts.isPropertyAccessExpression(node) && node.expression.getText(source) === "process" && node.name.text === "env") {
        assert.fail(`Server environment read in browser-safe module: ${file}`);
      }
      ts.forEachChild(node, scan);
    }
    scan(source);
    for (const spec of dependencies) {
      assert.ok(!spec.startsWith("node:") && spec !== "server-only", `Server dependency ${spec} in ${file}`);
      if (spec.endsWith(".css")) continue;
      const base = spec.startsWith("@/") ? path.resolve("src", spec.slice(2))
        : spec.startsWith(".") ? path.resolve(path.dirname(file), spec) : null;
      if (!base) continue;
      const target = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]
        .find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      assert.ok(target, `Unresolved local dependency ${spec} in ${file}`);
      visit(target);
    }
  }
  for (const entry of [
    "src/lib/henrik-model.ts", "src/lib/audit-coverage.ts", "src/lib/match-archive-payload.ts",
    "src/lib/report-scope.ts", "src/components/profile/audit-progress.tsx",
  ]) visit(path.resolve(entry));
});
