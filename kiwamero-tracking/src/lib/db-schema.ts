/**
 * Row types for the D1/sqlite schema in `db/schema.sql`.
 * Dates are stored as ISO strings, booleans as 0/1 (SQLite has neither type).
 */
export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  emailVerified: number;
  image: string | null;
  discordId: string | null;
  webhookUrl: string | null;
  webhookUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRow {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountRow {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scope: string | null;
  idToken: string | null;
  password: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationRow {
  id: string;
  identifier: string;
  value: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistEntryRow {
  id: string;
  userId: string;
  riotName: string;
  riotTag: string;
  puuid: string | null;
  region: string | null;
  note: string | null;
  lastSeenGameStart: number | null;
  lastNotifiedMatchId: string | null;
  lastNotifiedAt: string | null;
  createdAt: string;
}

export interface ApiKeyRow {
  id: string;
  userId: string;
  key: string;
  label: string | null;
  createdAt: string;
  revokedAt: string | null;
}

/** Table map for the Kysely instance used by Better Auth. */
export interface Database {
  User: UserRow;
  Session: SessionRow;
  Account: AccountRow;
  Verification: VerificationRow;
  WatchlistEntry: WatchlistEntryRow;
  ApiKey: ApiKeyRow;
}
