import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createPublicClient, http, type Chain } from "viem";
import { base, baseSepolia } from "viem/chains";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { db } from "./db";
import { upsertCreatorByWallet, getCreator, type Creator } from "./stations";

const SESSION_COOKIE = "mixtape_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const NONCE_TTL_MS = 1000 * 60 * 10;

// Chains we accept SIWE messages from. Add more here if/when the app expands.
const ALLOWED_CHAINS: Record<number, Chain> = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia
};

function publicClientForChain(chainId: number) {
  const chain = ALLOWED_CHAINS[chainId];
  if (!chain) {
    const err = new Error("Unsupported chain.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  // ALCHEMY_RPC_URL is server-side; if absent, viem falls back to the chain's
  // default public RPC, which may rate-limit ERC-1271/6492 deploy-checks.
  return createPublicClient({ chain, transport: http(process.env.ALCHEMY_RPC_URL) });
}

export function issueNonce(): string {
  const nonce = randomBytes(16).toString("hex");
  db.prepare(`INSERT INTO siwe_nonces (nonce, issued_at) VALUES (?, ?)`).run(nonce, Date.now());
  return nonce;
}

export function consumeNonce(nonce: string): boolean {
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
  if (!fields.address || !fields.nonce || !fields.chainId) {
    throw new Error("Invalid SIWE message.");
  }

  const valid = validateSiweMessage({
    message: fields,
    domain: options.expectedDomain,
    nonce: fields.nonce
  });
  if (!valid) throw new Error("SIWE message failed validation.");

  // Throws 400 "Unsupported chain." if chainId isn't in the allow-list.
  const publicClient = publicClientForChain(fields.chainId);

  if (!consumeNonce(fields.nonce)) {
    throw new Error("Nonce expired or already used.");
  }

  // verifyMessage handles all three signature types in one call:
  // - EOA: recovers the ECDSA signer.
  // - Deployed smart account: calls ERC-1271 isValidSignature.
  // - Counterfactual smart account: unwraps an ERC-6492 wrapper and simulates
  //   the deploy before validating, so brand-new Account Kit users sign in
  //   without first paying for an on-chain deploy.
  const signatureValid = await publicClient.verifyMessage({
    address: fields.address,
    message: rawMessage,
    signature
  });
  if (!signatureValid) {
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
    return jsonError(status >= 500 ? "Server error" : (error as Error).message || "Server error", status);
  }
}
