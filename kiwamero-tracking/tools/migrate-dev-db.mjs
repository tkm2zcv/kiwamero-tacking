// Apply the incremental schema upgrade to the local better-sqlite3 database.
// Usage: node tools/migrate-dev-db.mjs
import Database from "better-sqlite3";
import fs from "node:fs";

const dbPath = "prisma/dev.db";
const sqlPath = "prisma/d1/upgrade-2026-10-28.sql";
if (!fs.existsSync(dbPath)) {
  console.log("no dev.db yet — nothing to upgrade");
  process.exit(0);
}
const db = new Database(dbPath);
const existing = (table, column) =>
  db.prepare(`PRAGMA table_info('${table}')`).all().some((c) => c.name === column);

const statements = [
  ["User", "webhookUrl", 'ALTER TABLE "User" ADD COLUMN "webhookUrl" TEXT'],
  ["User", "webhookUpdatedAt", 'ALTER TABLE "User" ADD COLUMN "webhookUpdatedAt" DATETIME'],
  ["WatchlistEntry", "region", 'ALTER TABLE "WatchlistEntry" ADD COLUMN "region" TEXT'],
  ["WatchlistEntry", "lastSeenGameStart", 'ALTER TABLE "WatchlistEntry" ADD COLUMN "lastSeenGameStart" INTEGER'],
  ["WatchlistEntry", "lastNotifiedMatchId", 'ALTER TABLE "WatchlistEntry" ADD COLUMN "lastNotifiedMatchId" TEXT'],
  ["WatchlistEntry", "lastNotifiedAt", 'ALTER TABLE "WatchlistEntry" ADD COLUMN "lastNotifiedAt" DATETIME'],
];
for (const [table, column, sql] of statements) {
  if (existing(table, column)) {
    console.log(`skip ${table}.${column}`);
    continue;
  }
  db.exec(sql);
  console.log(`added ${table}.${column}`);
}
db.exec('CREATE INDEX IF NOT EXISTS "WatchlistEntry_riotName_riotTag_idx" ON "WatchlistEntry"("riotName","riotTag")');
console.log("done", sqlPath);
