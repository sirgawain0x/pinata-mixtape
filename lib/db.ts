import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const isVercel = process.env.VERCEL === "1";
const dbPath = isVercel
  ? path.join(os.tmpdir(), "mixtapes.db")
  : path.join(process.cwd(), "workspace", "data", "mixtapes.db");

if (!isVercel) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export const db = new Database(dbPath, { timeout: 5000 });

try {
  db.pragma("journal_mode = WAL");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("database is locked")) {
    throw error;
  }
}

db.pragma("foreign_keys = ON");
