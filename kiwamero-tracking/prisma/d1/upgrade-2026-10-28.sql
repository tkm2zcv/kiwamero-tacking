-- Incremental upgrade for databases created from the 2026-10-27 schema.sql.
-- Fresh environments only need prisma/d1/schema.sql.
-- Apply with:
--   wrangler d1 execute kiwamero-tracking --local --file prisma/d1/upgrade-2026-10-28.sql
--   wrangler d1 execute kiwamero-tracking --remote --file prisma/d1/upgrade-2026-10-28.sql

ALTER TABLE "User" ADD COLUMN "webhookUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "webhookUpdatedAt" DATETIME;

ALTER TABLE "WatchlistEntry" ADD COLUMN "region" TEXT;
ALTER TABLE "WatchlistEntry" ADD COLUMN "lastSeenGameStart" INTEGER;
ALTER TABLE "WatchlistEntry" ADD COLUMN "lastNotifiedMatchId" TEXT;
ALTER TABLE "WatchlistEntry" ADD COLUMN "lastNotifiedAt" DATETIME;

CREATE INDEX IF NOT EXISTS "WatchlistEntry_riotName_riotTag_idx" ON "WatchlistEntry"("riotName", "riotTag");
