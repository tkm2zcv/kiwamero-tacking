CREATE TABLE IF NOT EXISTS ProfileSnapshot (
  cacheKey TEXT PRIMARY KEY,
  puuid TEXT,
  payload BLOB,
  capturedAt INTEGER NOT NULL DEFAULT 0,
  invalidatedAt INTEGER NOT NULL DEFAULT 0,
  refreshToken TEXT,
  refreshUntil INTEGER NOT NULL DEFAULT 0,
  retryAt INTEGER NOT NULL DEFAULT 0
);
