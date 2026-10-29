/**
 * Database access: raw parameterized SQL over Cloudflare D1 (production
 * Workers, `wrangler dev`, and `next dev` via initOpenNextCloudflareForDev) or
 * a local better-sqlite3 file everywhere else (`node --test`, scripts).
 *
 * `db` is a Kysely instance whose dialect resolves the backend lazily on first
 * query — Better Auth needs a synchronous database handle, but the D1 binding
 * is only reachable asynchronously through the Cloudflare context.
 *
 * Replaces Prisma, which cannot run on workerd (runtime Wasm compilation is
 * disallowed by the embedder).
 */
import {
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type QueryCompiler,
  type QueryResult,
} from "kysely";
import type { Database } from "./db-schema";

interface D1ResultLike {
  results?: Record<string, unknown>[];
  meta?: { changes?: number; last_row_id?: number | null };
}
interface D1PreparedStatementLike {
  bind(...values: unknown[]): { all(): Promise<D1ResultLike> };
}
interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

interface SqlResult {
  rows: Record<string, unknown>[];
  changes?: number;
  lastRowId?: number;
}
interface SqlBackend {
  run(query: string, params: unknown[]): Promise<SqlResult>;
}

function d1Backend(d1: D1DatabaseLike): SqlBackend {
  return {
    async run(query, params) {
      const res = await d1.prepare(query).bind(...params).all();
      return {
        rows: res.results ?? [],
        changes: res.meta?.changes,
        lastRowId: res.meta?.last_row_id ?? undefined,
      };
    },
  };
}

function betterSqliteBackend(db: import("better-sqlite3").Database): SqlBackend {
  return {
    async run(query, params) {
      const stmt = db.prepare(query);
      // `reader` is true for statements that return rows (SELECT/RETURNING).
      if (stmt.reader) return { rows: stmt.all(...params) as Record<string, unknown>[] };
      const info = stmt.run(...params);
      return { rows: [], changes: info.changes, lastRowId: Number(info.lastInsertRowid) };
    },
  };
}

/** D1/better-sqlite3 both bind only primitive values. */
function normalizeParam(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

const BACKEND_INIT_TIMEOUT_MS = 8_000;

function inWorkerd(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

async function createBackend(): Promise<SqlBackend> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    // SYNC mode only: the async mode spawns wrangler's getPlatformProxy when the
    // context global is missing — under nodejs_compat that means NEXT_RUNTIME is
    // "nodejs" even inside workerd, and the proxy spawn hangs the isolate for
    // good (observed: ~42s waitUntil-cancelled requests on cold isolates).
    const { env } = getCloudflareContext();
    const d1 = (env as { DB?: D1DatabaseLike } | undefined)?.DB;
    if (d1) return d1Backend(d1);
  } catch {
    // No Cloudflare context — plain Node (tests, scripts) or out-of-request use.
  }
  if (inWorkerd()) {
    // better-sqlite3 cannot exist in workerd; fail fast instead of letting a
    // broken native import surface as a confusing error later.
    throw new Error("DB binding unavailable in worker context (no Cloudflare env)");
  }
  const { default: Database } = await import("better-sqlite3");
  const file = (process.env.DATABASE_URL ?? "file:./db/dev.db").replace(/^file:/, "");
  return betterSqliteBackend(new Database(file));
}

let backendPromise: Promise<SqlBackend> | undefined;
export function resolveBackend(): Promise<SqlBackend> {
  backendPromise ??= Promise.race([
    createBackend(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("db backend init timeout")), BACKEND_INIT_TIMEOUT_MS),
    ),
  ]).catch((error) => {
    // Do not poison the isolate: a failed resolution is retried on next request.
    backendPromise = undefined;
    throw error;
  });
  return backendPromise;
}

class BackendConnection implements DatabaseConnection {
  async executeQuery<R>(compiled: CompiledQuery<unknown>): Promise<QueryResult<R>> {
    const backend = await resolveBackend();
    const { rows, changes, lastRowId } = await backend.run(
      compiled.sql,
      compiled.parameters.map(normalizeParam),
    );
    return {
      rows: rows as R[],
      numAffectedRows: changes != null ? BigInt(changes) : undefined,
      insertId: lastRowId != null ? BigInt(lastRowId) : undefined,
    };
  }

  async *streamQuery(): AsyncIterableIterator<QueryResult<never>> {
    throw new Error("streaming queries are not supported");
  }
}

class BackendDriver implements Driver {
  readonly #connection = new BackendConnection();
  async init(): Promise<void> {}
  async acquireConnection(): Promise<DatabaseConnection> {
    return this.#connection;
  }
  async beginTransaction(): Promise<void> {
    throw new Error("interactive transactions are not supported (D1 has none)");
  }
  async commitTransaction(): Promise<void> {
    throw new Error("interactive transactions are not supported (D1 has none)");
  }
  async rollbackTransaction(): Promise<void> {
    throw new Error("interactive transactions are not supported (D1 has none)");
  }
  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {}
}

class BackendDialect implements Dialect {
  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }
  createDriver(): Driver {
    return new BackendDriver();
  }
  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }
  createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}

/** Kysely instance consumed by Better Auth (type: "sqlite"). */
export const db = new Kysely<Database>({ dialect: new BackendDialect() });

export async function queryAll<T = Record<string, unknown>>(
  query: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const backend = await resolveBackend();
  const { rows } = await backend.run(query, params.map(normalizeParam));
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  query: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  return (await queryAll<T>(query, params))[0] ?? null;
}

export async function execute(
  query: string,
  params: readonly unknown[] = [],
): Promise<{ changes: number; lastRowId?: number }> {
  const backend = await resolveBackend();
  const { changes, lastRowId } = await backend.run(query, params.map(normalizeParam));
  return { changes: changes ?? 0, lastRowId };
}
