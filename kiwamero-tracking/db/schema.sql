-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "discordId" TEXT,
    "webhookUrl" TEXT,
    "webhookUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WatchlistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "riotName" TEXT NOT NULL,
    "riotTag" TEXT NOT NULL,
    "puuid" TEXT,
    "region" TEXT,
    "note" TEXT,
    "lastSeenGameStart" INTEGER,
    "lastNotifiedMatchId" TEXT,
    "lastNotifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "WatchlistEntry_riotName_riotTag_idx" ON "WatchlistEntry"("riotName", "riotTag");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistEntry_userId_riotName_riotTag_key" ON "WatchlistEntry"("userId", "riotName", "riotTag");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- Historical analysis and shared upstream budgeting (upgrade-2026-10-30.sql).
CREATE TABLE IF NOT EXISTS HenrikQuota (
  keyHash TEXT PRIMARY KEY, uses TEXT NOT NULL DEFAULT '[]',
  cooldownUntil INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS MatchArchive (
  matchId TEXT PRIMARY KEY, payload TEXT, fetchedAt INTEGER,
  leaseToken TEXT, leaseUntil INTEGER NOT NULL DEFAULT 0,
  retryAt INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
  lastStatus INTEGER, terminal INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS AuditHistory (
  puuid TEXT PRIMARY KEY, riotName TEXT NOT NULL, riotTag TEXT NOT NULL,
  region TEXT NOT NULL, rowsJson TEXT NOT NULL, syncedAt INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS AuditMatch (
  puuid TEXT NOT NULL REFERENCES AuditHistory(puuid),
  matchId TEXT NOT NULL REFERENCES MatchArchive(matchId),
  startedAt INTEGER NOT NULL, priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (puuid, matchId)
);
CREATE INDEX IF NOT EXISTS AuditMatch_matchId_idx ON AuditMatch(matchId);
CREATE INDEX IF NOT EXISTS MatchArchive_pending_idx ON MatchArchive(terminal, retryAt, leaseUntil);
