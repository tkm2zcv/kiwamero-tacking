import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CSP allows generated share-card blob previews", () => {
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /"img-src 'self' data: blob: https:"/);
});
