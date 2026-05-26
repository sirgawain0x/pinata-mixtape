import SQLite from "better-sqlite3";
import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { bootstrapLibsql, bootstrapSqlite } from "./schema-bootstrap";

/** True when durable app data uses Turso (Vercel / any shared deployment). */
export function useLibsql(): boolean {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const token = process.env.TURSO_AUTH_TOKEN?.trim();
  return Boolean(url && token);
}

/** Local SQLite DB handle (better-sqlite3). */
export type SqliteDb = SQLite.Database;

let sqliteDb: SqliteDb | null = null;
let tursoClient: Client | null = null;
let initPromise: Promise<void> | null = null;

export function getLibsqlClient(): Client {
  if (!useLibsql()) {
    throw new Error("Turso is not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN).");
  }
  if (!tursoClient) {
    tursoClient = createClient({
      url: process.env.TURSO_DATABASE_URL!.trim(),
      authToken: process.env.TURSO_AUTH_TOKEN!.trim()
    });
  }
  return tursoClient;
}

/** Local SQLite (development / self-hosted without Turso). Not available on Vercel without Turso. */
export function getSqliteDatabase(): SqliteDb {
  if (useLibsql()) {
    throw new Error("SQLite file backend is disabled when Turso env vars are set.");
  }
  if (process.env.VERCEL === "1") {
    throw new Error(
      "SQLite file cannot persist on Vercel. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for Turso/libSQL."
    );
  }
  if (!sqliteDb) {
    const dbPath = path.join(process.cwd(), "workspace", "data", "mixtapes.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    sqliteDb = new SQLite(dbPath, { timeout: 5000 });
    try {
      sqliteDb.pragma("journal_mode = WAL");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("database is locked")) {
        throw error;
      }
    }
    sqliteDb.pragma("foreign_keys = ON");
    bootstrapSqlite(sqliteDb);
  }
  return sqliteDb;
}

async function initialize(): Promise<void> {
  if (useLibsql()) {
    await bootstrapLibsql(getLibsqlClient());
  } else {
    getSqliteDatabase();
  }
}

/** Ensures schema exists before any query. */
export function dbReady(): Promise<void> {
  if (!initPromise) initPromise = initialize();
  return initPromise;
}
