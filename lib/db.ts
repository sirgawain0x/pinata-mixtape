import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "workspace", "data");
const dbPath = path.join(dataDir, "mixtapes.db");

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath, { timeout: 5000 });

try {
  db.pragma("journal_mode = WAL");
} catch (error) {
  // During `next build`, multiple workers may touch the DB concurrently.
  // Keep startup resilient when SQLite reports a transient lock.
  if (!(error instanceof Error) || !error.message.includes("database is locked")) {
    throw error;
  }
}

db.pragma("foreign_keys = ON");
