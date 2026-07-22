import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Postgres client + Drizzle instance.
 *
 * Works unchanged on Supabase, Neon, RDS, or bare Postgres — the only
 * provider-specific input is DATABASE_URL.
 *
 * `prepare: false` is required for transaction-mode poolers (Supabase
 * Supavisor :6543, PgBouncer) because prepared statements don't survive
 * connection multiplexing. It's harmless on direct connections.
 *
 * The globalThis cache prevents Next.js dev hot-reload from opening a new
 * pool on every file change.
 */

const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (expected in .env.local)");
  }
  return postgres(url, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const client = globalForDb.__pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient = client;
}

export const db = drizzle(client, { schema });

export type Db = typeof db;
/** Transaction handle — accepted by every repository function. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export * as tables from "./schema";
