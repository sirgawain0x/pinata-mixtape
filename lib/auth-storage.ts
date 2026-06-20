import { randomBytes } from "node:crypto";
import { dbReady } from "./db";
import { sqlGet, sqlRun } from "./sql-bridge";
import type { Creator } from "./stations";

export const NONCE_TTL_MS = 1000 * 60 * 10;
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export async function issueNonceStorage(): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  await dbReady();
  await sqlRun(`INSERT INTO siwe_nonces (nonce, issued_at) VALUES (?, ?)`, [nonce, Date.now()]);
  return nonce;
}

export async function purgeExpiredNoncesStorage(): Promise<void> {
  await dbReady();
  const now = Date.now();
  await sqlRun(`DELETE FROM siwe_nonces WHERE issued_at < ?`, [now - NONCE_TTL_MS]);
  await sqlRun(`DELETE FROM sessions WHERE expires_at < ?`, [now]);
}

export async function consumeNonceStorage(nonce: string): Promise<boolean> {
  await dbReady();
  const result = await sqlRun(
    `UPDATE siwe_nonces
       SET consumed = 1
       WHERE nonce = ?
         AND consumed = 0
         AND issued_at >= ?`,
    [nonce, Date.now() - NONCE_TTL_MS]
  );
  if (result.changes === 0) {
    await sqlRun(`DELETE FROM siwe_nonces WHERE nonce = ? AND issued_at < ?`, [nonce, Date.now() - NONCE_TTL_MS]);
    return false;
  }
  return true;
}

export async function issueSessionStorage(creator: Creator): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await dbReady();
  await sqlRun(`INSERT INTO sessions (token, creator_id, issued_at, expires_at) VALUES (?, ?, ?, ?)`, [
    token,
    creator.id,
    now,
    now + SESSION_TTL_MS
  ]);
  return token;
}

export type SessionLookup = {
  creatorId: number;
};

export async function lookupSessionStorage(token: string | undefined): Promise<SessionLookup | null> {
  if (!token) return null;

  await dbReady();
  const row = await sqlGet<{ creator_id: number; expires_at: number }>(
    `SELECT creator_id, expires_at FROM sessions WHERE token = ?`,
    [token]
  );
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await sqlRun(`DELETE FROM sessions WHERE token = ?`, [token]);
    return null;
  }
  return { creatorId: row.creator_id };
}

export async function revokeSessionStorage(token: string): Promise<void> {
  await dbReady();
  await sqlRun(`DELETE FROM sessions WHERE token = ?`, [token]);
}
