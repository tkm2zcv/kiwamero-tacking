import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

interface CfEnv {
  DB?: {
    prepare: (q: string) => unknown;
    batch: (s: unknown[]) => Promise<unknown>;
    exec: (q: string) => Promise<unknown>;
  };
}

const globalForPrisma = globalThis as unknown as { prismaPromise?: Promise<PrismaClient> };

async function createClient(): Promise<PrismaClient> {
  // On Cloudflare Workers (OpenNext), resolve the D1 binding.
  // Locally (`next dev` without wrangler) fall back to better-sqlite3.
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as CfEnv | undefined)?.DB;
    if (db) {
      const { PrismaD1 } = await import("@prisma/adapter-d1");
      console.log("[prisma] using D1 adapter");
      return new PrismaClient({ adapter: new PrismaD1(db as never) });
    }
    console.log("[prisma] cloudflare context present but no DB binding — using sqlite");
  } catch (e) {
    console.log("[prisma] no cloudflare context — using sqlite", e instanceof Error ? e.message : "");
  }
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  return new PrismaClient({ adapter });
}

function getClient(): Promise<PrismaClient> {
  globalForPrisma.prismaPromise ??= createClient();
  return globalForPrisma.prismaPromise;
}

// Lazy two-level proxy: prisma.<model>.<method>(...args) resolves the real
// client on first use, keeping call sites synchronous-looking while the
// underlying adapter may be async-resolved (D1 binding via OpenNext).
export const prisma = new Proxy({} as PrismaClient, {
  get:
    (_t, model: string | symbol) =>
    new Proxy({} as Record<string | symbol, unknown>, {
      get:
        (_m, method: string | symbol) =>
        async (...args: unknown[]) => {
          const client = await getClient();
          const target = (client as unknown as Record<string | symbol, Record<string | symbol, (...a: unknown[]) => unknown>>)[model];
          const fn = target?.[method];
          if (typeof fn !== "function") throw new Error(`prisma.${String(model)}.${String(method)} is not a function`);
          return fn.apply(target, args);
        },
    }),
});
