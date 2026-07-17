import { PrivyClient } from "@privy-io/server-auth";
import { isAddress, getAddress } from "viem";
import {
  clearSessionCookie,
  getSessionToken,
  jsonError,
  revokeSession,
  setSessionCookie
} from "../../../../lib/auth";
import { issueSessionStorage } from "../../../../lib/auth-storage";
import { upsertCreatorByWallet } from "../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getPrivyClient(): PrivyClient | null {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return null;
  return new PrivyClient(appId, appSecret);
}

export async function POST(request: Request) {
  const privy = getPrivyClient();
  if (!privy) {
    return jsonError("Privy server auth is not configured (PRIVY_APP_SECRET).", 500);
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonError("Missing Privy access token.", 401);

  try {
    await privy.verifyAuthToken(token);
  } catch {
    return jsonError("Invalid Privy access token.", 401);
  }

  const body = await request.json().catch(() => null);
  const walletAddress =
    typeof body?.walletAddress === "string" ? body.walletAddress.trim() : "";
  if (!isAddress(walletAddress)) {
    return jsonError("A valid walletAddress is required.", 400);
  }

  const creator = await upsertCreatorByWallet(getAddress(walletAddress));
  const sessionToken = await issueSessionStorage(creator);
  await setSessionCookie(sessionToken);

  return Response.json({
    creator: {
      id: creator.id,
      walletAddress: creator.walletAddress,
      displayName: creator.displayName,
      meTokenAddress: creator.meTokenAddress
    }
  });
}

export async function DELETE() {
  const token = await getSessionToken();
  if (token) {
    await revokeSession(token);
  }
  await clearSessionCookie();
  return Response.json({ ok: true });
}
