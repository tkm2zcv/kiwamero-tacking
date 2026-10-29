import { betterAuth } from "better-auth";
import { db } from "./db.ts";

export const auth = betterAuth({
  appName: "Kiwamero Tracking",
  // Kysely adapter over the lazily-resolved D1/sqlite backend (src/lib/db.ts).
  // D1 has no interactive transactions; sqlite stores dates as ISO strings and
  // booleans as 0/1 (handled by the adapter).
  database: { db, type: "sqlite", transaction: false },
  // Table names in db/schema.sql keep the original PascalCase names.
  user: { modelName: "User" },
  session: { modelName: "Session" },
  account: { modelName: "Account" },
  verification: { modelName: "Verification" },
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
    },
  },
});

export type Session = typeof auth.$Infer.Session;
