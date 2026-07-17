import { getAddress, isAddress } from "viem";
import {
  clearSessionCookie,
  getSessionToken,
  jsonError,
  revokeSession,
  setSessionCookie
} from "../../../../lib/auth";
import { issueSessionStorage } from "../../../../lib/auth-storage";
import {
  assertWalletOwnedBySigner,
  extractBearerToken,
  getLinkedEthereumAddresses,
  getPrivyClient,
  verifyPrivyAccessToken
} from "../../../../lib/privy-server";
import { upsertCreatorByWallet } from "../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!getPrivyClient()) {
    return jsonError("Privy server auth is not configured (PRIVY_APP_SECRET).", 500);
  }

  const token = extractBearerToken(request);
  if (!token) return jsonError("Missing Privy access token.", 401);

  let user;
  try {
    ({ user } = await verifyPrivyAccessToken(token));
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    return jsonError(
      status === 500
        ? (error as Error).message
        : "Invalid Privy access token.",
      status === 500 ? 500 : 401
    );
  }

  const body = await request.json().catch(() => null);
  const walletAddress =
    typeof body?.walletAddress === "string" ? body.walletAddress.trim() : "";
  const signerAddress =
    typeof body?.signerAddress === "string" ? body.signerAddress.trim() : "";

  if (!isAddress(walletAddress)) {
    return jsonError("A valid walletAddress is required.", 400);
  }
  if (!isAddress(signerAddress)) {
    return jsonError("A valid signerAddress is required.", 400);
  }

  const linked = getLinkedEthereumAddresses(user);
  if (!linked.has(getAddress(signerAddress).toLowerCase())) {
    return jsonError("signerAddress is not linked to this Privy user.", 403);
  }

  try {
    await assertWalletOwnedBySigner(getAddress(walletAddress), getAddress(signerAddress));
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 403;
    return jsonError((error as Error).message || "Wallet ownership check failed.", status);
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
