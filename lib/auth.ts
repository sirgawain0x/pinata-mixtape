import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { type Address, recoverMessageAddress, isAddressEqual } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { db } from "./db";
import { upsertCreatorByWallet, getCreator, type Creator } from "./stations";

const SESSION_COOKIE = "mixtape_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const NONCE_TTL_MS = 1000 * 60 * 10;

export function issueNonce(): string {
  const nonce = randomBytes(16).toString("hex");
  db.prepare(`INSERT INTO siwe_nonces (nonce, issued_at) VALUES (?, ?)`).run(nonce, Date.now());
  return nonce;
}

export function consumeNonce(nonce: string): boolean {
  const row = db
    .prepare(`SELECT issued_at, consumed FROM siwe_nonces WHERE nonce = ?`)
    .get(nonce) as { issued_at: number; consumed: number } | undefined;
  if (!row) return false;
  if (row.consumed) return false;
  if (Date.now() - row.issued_at > NONCE_TTL_MS) {
    db.prepare(`DELETE FROM siwe_nonces WHERE nonce = ?`).run(nonce);
    return false;
  }
  db.prepare(`UPDATE siwe_nonces SET consumed = 1 WHERE nonce = ?`).run(nonce);
  return true;
}

export function purgeExpiredNonces(): void {
  db.prepare(`DELETE FROM siwe_nonces WHERE issued_at < ?`).run(Date.now() - NONCE_TTL_MS);
}

function issueSession(creatorId: number): string {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (token, creator_id, issued_at, expires_at) VALUES (?, ?, ?, ?)`
  ).run(token, creatorId, now, now + SESSION_TTL_MS);
  return token;
}

export function revokeSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

function lookupSession(token: string | undefined): { creatorId: number } | null {
  if (!token) return null;
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

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function getCurrentCreator(): Promise<Creator | null> {
  const token = await getSessionToken();
  const session = lookupSession(token);
  if (!session) return null;
  return getCreator(session.creatorId);
}

export async function requireCreator(): Promise<Creator> {
  const creator = await getCurrentCreator();
  if (!creator) {
    const error = new Error("Authentication required.");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return creator;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function verifySiweAndIssueSession(
  rawMessage: string,
  signature: `0x${string}`,
  options: { expectedDomain: string }
): Promise<Creator> {
  const fields = parseSiweMessage(rawMessage);
  if (!fields.address || !fields.nonce) {
    throw new Error("Invalid SIWE message.");
  }

  const valid = validateSiweMessage({
    message: fields,
    domain: options.expectedDomain,
    nonce: fields.nonce
  });
  if (!valid) throw new Error("SIWE message failed validation.");

  if (!consumeNonce(fields.nonce)) {
    throw new Error("Nonce expired or already used.");
  }

  const recovered = await recoverMessageAddress({
    message: rawMessage,
    signature
  });
  if (!isAddressEqual(recovered as Address, fields.address as Address)) {
    throw new Error("Signature does not match address.");
  }

  const creator = upsertCreatorByWallet(fields.address);
  const token = issueSession(creator.id);
  await setSessionCookie(token);
  return creator;
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export async function withCreator(
  handler: (creator: Creator) => Promise<Response> | Response
): Promise<Response> {
  try {
    const creator = await requireCreator();
    return await handler(creator);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    return jsonError((error as Error).message || "Server error", status);
  }
}
