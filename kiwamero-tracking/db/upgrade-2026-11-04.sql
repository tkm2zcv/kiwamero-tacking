CREATE TABLE IF NOT EXISTS RosterHistory (
  puuid TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  targetsJson TEXT NOT NULL DEFAULT '[]',
  observedAt INTEGER NOT NULL DEFAULT 0,
  cursor INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  exhausted INTEGER NOT NULL DEFAULT 0,
  blocked INTEGER NOT NULL DEFAULT 0,
  lastPage TEXT,
  updatedAt INTEGER NOT NULL DEFAULT 0,
  leaseToken TEXT,
  leaseUntil INTEGER NOT NULL DEFAULT 0,
  retryAt INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  lastStatus INTEGER
);
CREATE TABLE IF NOT EXISTS RosterHistoryMatch (
  puuid TEXT NOT NULL REFERENCES RosterHistory(puuid),
  matchId TEXT NOT NULL,
  PRIMARY KEY (puuid, matchId)
);
CREATE INDEX IF NOT EXISTS RosterHistory_pending_idx ON RosterHistory(active, blocked, retryAt, leaseUntil, updatedAt);
CREATE INDEX IF NOT EXISTS RosterHistoryMatch_matchId_idx ON RosterHistoryMatch(matchId);
