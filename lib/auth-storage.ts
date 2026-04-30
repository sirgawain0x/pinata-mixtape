import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";
import { createClient, type RedisClientType } from "redis";
import { db } from "./db";
import type { Creator } from "./stations";

export const NONCE_TTL_MS = 1000 * 60 * 10;
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const nonceKey = (n: string) => `mixtape:siwe:${n}`;
const sessionKey = (t: string) => `mixtape:sess:${t}`;

type KvMode = "tcp" | "upstash" | "off";

/** Vercel Marketplace Redis uses REDIS_URL (TCP). Upstash REST uses UPSTASH_* (optional fallback). */
function kvMode(): KvMode {
  if (process.env.REDIS_URL) return "tcp";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash";
  return "off";
}

const globalRedis = globalThis as typeof globalThis & {
  __pinataMixtapeRedis?: RedisClientType;
  __pinataMixtapeRedisConnect?: Promise<void>;
};

async function tcpRedis(): Promise<RedisClientType> {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set.");

  if (!globalRedis.__pinataMixtapeRedis) {
    const client = createClient({ url });
    client.on("error", (err) => console.error("[redis]", err));
    globalRedis.__pinataMixtapeRedis = client as RedisClientType;
  }

  if (!globalRedis.__pinataMixtapeRedisConnect) {
    globalRedis.__pinataMixtapeRedisConnect = globalRedis.__pinataMixtapeRedis.connect().then(() => {});
  }
  await globalRedis.__pinataMixtapeRedisConnect;
  return globalRedis.__pinataMixtapeRedis;
}

let upstashSingleton: Redis | null = null;

function upstash(): Redis {
  if (!upstashSingleton) upstashSingleton = Redis.fromEnv();
  return upstashSingleton;
}

/** True when SIWE nonces and sessions use Redis (Vercel Marketplace or Upstash REST). */
export function isKvAuthEnabled(): boolean {
  return kvMode() !== "off";
}

export async function issueNonceStorage(): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  const mode = kvMode();
  if (mode === "tcp") {
    const c = await tcpRedis();
    await c.set(nonceKey(nonce), "1", { PX: NONCE_TTL_MS });
    return nonce;
  }
  if (mode === "upstash") {
    await upstash().set(nonceKey(nonce), "1", { px: NONCE_TTL_MS });
    return nonce;
  }
  db.prepare(`INSERT INTO siwe_nonces (nonce, issued_at) VALUES (?, ?)`).run(nonce, Date.now());
  return nonce;
}

export async function purgeExpiredNoncesStorage(): Promise<void> {
  if (kvMode() !== "off") return;
  db.prepare(`DELETE FROM siwe_nonces WHERE issued_at < ?`).run(Date.now() - NONCE_TTL_MS);
}

export async function consumeNonceStorage(nonce: string): Promise<boolean> {
  const mode = kvMode();
  if (mode === "tcp") {
    const c = await tcpRedis();
    const v = await c.getDel(nonceKey(nonce));
    return v != null;
  }
  if (mode === "upstash") {
    const v = await upstash().getdel(nonceKey(nonce));
    return v != null;
  }
  const result = db
    .prepare(
      `UPDATE siwe_nonces
       SET consumed = 1
       WHERE nonce = ?
         AND consumed = 0
         AND issued_at >= ?`
    )
    .run(nonce, Date.now() - NONCE_TTL_MS);
  if (result.changes === 0) {
    db.prepare(`DELETE FROM siwe_nonces WHERE nonce = ? AND issued_at < ?`).run(nonce, Date.now() - NONCE_TTL_MS);
    return false;
  }
  return true;
}

type KvSessionPayload = {
  creatorId: number;
  issuedAt: number;
  expiresAt: number;
  creator: Creator;
};

export async function issueSessionStorage(creator: Creator): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const mode = kvMode();
  if (mode === "tcp") {
    const c = await tcpRedis();
    const payload: KvSessionPayload = {
      creatorId: creator.id,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
      creator
    };
    await c.set(sessionKey(token), JSON.stringify(payload), {
      EX: Math.ceil(SESSION_TTL_MS / 1000)
    });
    return token;
  }
  if (mode === "upstash") {
    const payload: KvSessionPayload = {
      creatorId: creator.id,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
      creator
    };
    await upstash().set(sessionKey(token), JSON.stringify(payload), {
      ex: Math.ceil(SESSION_TTL_MS / 1000)
    });
    return token;
  }
  db.prepare(`INSERT INTO sessions (token, creator_id, issued_at, expires_at) VALUES (?, ?, ?, ?)`).run(
    token,
    creator.id,
    now,
    now + SESSION_TTL_MS
  );
  return token;
}

export type SessionLookup = {
  creatorId: number;
  /** Populated for KV sessions so /me works when SQLite is empty on another instance. */
  creatorFallback?: Creator;
};

export async function lookupSessionStorage(token: string | undefined): Promise<SessionLookup | null> {
  if (!token) return null;
  const mode = kvMode();

  if (mode === "tcp") {
    const c = await tcpRedis();
    const raw = await c.get(sessionKey(token));
    if (raw == null) return null;
    let payload: KvSessionPayload;
    try {
      payload = JSON.parse(raw) as KvSessionPayload;
    } catch {
      await c.del(sessionKey(token));
      return null;
    }
    if (payload.expiresAt < Date.now()) {
      await c.del(sessionKey(token));
      return null;
    }
    return { creatorId: payload.creatorId, creatorFallback: payload.creator };
  }

  if (mode === "upstash") {
    const raw = await upstash().get<string>(sessionKey(token));
    if (raw == null) return null;
    let payload: KvSessionPayload;
    try {
      payload = JSON.parse(raw) as KvSessionPayload;
    } catch {
      await upstash().del(sessionKey(token));
      return null;
    }
    if (payload.expiresAt < Date.now()) {
      await upstash().del(sessionKey(token));
      return null;
    }
    return { creatorId: payload.creatorId, creatorFallback: payload.creator };
  }

  const row = db
    .prepare(`SELECT creator_id, expires_at FROM sessions WHERE token = ?`)
    .get(token) as { creator_id: number; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }
  return { creatorId: row.creator_id };
}

export async function revokeSessionStorage(token: string): Promise<void> {
  const mode = kvMode();
  if (mode === "tcp") {
    const c = await tcpRedis();
    await c.del(sessionKey(token));
    return;
  }
  if (mode === "upstash") {
    await upstash().del(sessionKey(token));
    return;
  }
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}
