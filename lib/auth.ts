import { cookies } from "next/headers";
import { createPublicClient, http, type Chain } from "viem";
import { base, baseSepolia } from "viem/chains";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import {
  consumeNonceStorage,
  issueSessionStorage,
  lookupSessionStorage,
  revokeSessionStorage,
  SESSION_TTL_MS,
  isKvAuthEnabled
} from "./auth-storage";
import { upsertCreatorByWallet, getCreator, getCreatorByWallet, type Creator } from "./stations";

export { isKvAuthEnabled };

const SESSION_COOKIE = "mixtape_session";

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
  return createPublicClient({ chain, transport: http(process.env.ALCHEMY_RPC_URL) });
}

export async function revokeSession(token: string): Promise<void> {
  await revokeSessionStorage(token);
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function getCurrentCreator(): Promise<Creator | null> {
  const token = await getSessionToken();
  const session = await lookupSessionStorage(token);
  if (!session) return null;

  // Always resolve by wallet when the session carries it (Redis/KV). Stale creatorId values
  // from the pre-Turso ephemeral DB caused stations to be written under one id and listed
  // under another (or not at all).
  const wallet = session.creatorFallback?.walletAddress?.trim();
  if (wallet) {
    const byWallet = await getCreatorByWallet(wallet);
    if (byWallet) return byWallet;
    return await upsertCreatorByWallet(wallet);
  }

  const fromDb = await getCreator(session.creatorId);
  if (fromDb) return fromDb;
  return null;
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

  const publicClient = publicClientForChain(fields.chainId);

  if (!(await consumeNonceStorage(fields.nonce))) {
    throw new Error("Nonce expired or already used.");
  }

  const signatureValid = await publicClient.verifyMessage({
    address: fields.address,
    message: rawMessage,
    signature
  });
  if (!signatureValid) {
    throw new Error("Signature does not match address.");
  }

  const creator = await upsertCreatorByWallet(fields.address);
  const token = await issueSessionStorage(creator);
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
