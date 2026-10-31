// Loader hooks so `node --test` can exercise Next.js route handlers directly:
// resolves the "@/" src alias and extensionless relative imports, stubs the
// "server-only" marker package, replaces better-auth wiring (sessions are not
// needed — tests authenticate via seeded kt_ keys), and bridges the CJS-only
// "next/server" entry into ESM through createRequire.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const EMPTY = "data:text/javascript,export default {};";
const AUTH_STUB = "data:text/javascript," + encodeURIComponent(
  "export const auth = { api: { getSession: async () => null } };",
);
const NEXT_SERVER = "data:text/javascript," + encodeURIComponent(
  `import { createRequire } from "node:module";
const require = createRequire(${JSON.stringify(pathToFileURL(path.join(ROOT, "package.json")).href)});
const m = require("next/server");
export const NextRequest = m.NextRequest;
export const NextResponse = m.NextResponse;
export const NextURL = m.NextURL;
export default m;`,
);

function withExtensions(base) {
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`,
    path.join(base, "index.ts"), path.join(base, "index.tsx"), path.join(base, "index.js")]) {
    try { if (fs.statSync(cand).isFile()) return cand; } catch { /* keep looking */ }
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: EMPTY, shortCircuit: true };
  if (specifier === "next/server") return { url: NEXT_SERVER, shortCircuit: true };
  if (specifier === "@/lib/auth") return { url: AUTH_STUB, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const hit = withExtensions(path.join(SRC, specifier.slice(2)));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  try {
    return await next(specifier, context);
  } catch (error) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) &&
      typeof context.parentURL === "string" && context.parentURL.startsWith("file:")) {
      const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      const hit = withExtensions(base);
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
    throw error;
  }
}
