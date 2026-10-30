CREATE TABLE IF NOT EXISTS HenrikQuota (
  keyHash TEXT PRIMARY KEY,
  uses TEXT NOT NULL DEFAULT '[]',
  cooldownUntil INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS MatchArchive (
  matchId TEXT PRIMARY KEY,
  payload TEXT,
  fetchedAt INTEGER,
  leaseToken TEXT,
  leaseUntil INTEGER NOT NULL DEFAULT 0,
  retryAt INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  lastStatus INTEGER,
  terminal INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS AuditHistory (
  puuid TEXT PRIMARY KEY,
  riotName TEXT NOT NULL,
  riotTag TEXT NOT NULL,
  region TEXT NOT NULL,
  rowsJson TEXT NOT NULL,
  syncedAt INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS AuditMatch (
  puuid TEXT NOT NULL REFERENCES AuditHistory(puuid),
  matchId TEXT NOT NULL REFERENCES MatchArchive(matchId),
  startedAt INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (puuid, matchId)
);
CREATE INDEX IF NOT EXISTS AuditMatch_matchId_idx ON AuditMatch(matchId);
CREATE INDEX IF NOT EXISTS MatchArchive_pending_idx ON MatchArchive(terminal, retryAt, leaseUntil);
