-- Observed profile self stats and archived payload projections for analysis
-- One row per (owner, match), independent of optional detail-queue admission
CREATE TABLE IF NOT EXISTS AuditRow (
  puuid TEXT NOT NULL,
  matchId TEXT NOT NULL,
  rowJson TEXT NOT NULL,
  PRIMARY KEY (puuid, matchId)
);
CREATE INDEX IF NOT EXISTS AuditRow_matchId_idx ON AuditRow(matchId);
