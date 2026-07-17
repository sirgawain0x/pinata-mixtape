import { PrivyClient, type User } from "@privy-io/server-auth";
import { createPublicClient, getAddress, http, isAddress, type Address } from "viem";
import { chain, getAlchemyRpcUrl } from "./chain";

const OWNER_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
] as const;

export function getPrivyClient(): PrivyClient | null {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return null;
  return new PrivyClient(appId, appSecret);
}

export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

export async function verifyPrivyAccessToken(token: string): Promise<{ userId: string; user: User }> {
  const privy = getPrivyClient();
  if (!privy) {
    throw Object.assign(new Error("Privy server auth is not configured (PRIVY_APP_SECRET)."), {
      status: 500
    });
  }
  const claims = await privy.verifyAuthToken(token);
  const user = await privy.getUser(claims.userId);
  return { userId: claims.userId, user };
}

export function getLinkedEthereumAddresses(user: User): Set<string> {
  const addresses = new Set<string>();
  for (const account of user.linkedAccounts) {
    if (
      (account.type === "wallet" || account.type === "smart_wallet") &&
      typeof account.address === "string" &&
      isAddress(account.address)
    ) {
      addresses.add(getAddress(account.address).toLowerCase());
    }
  }
  if (user.wallet?.address && isAddress(user.wallet.address)) {
    addresses.add(getAddress(user.wallet.address).toLowerCase());
  }
  return addresses;
}

/** Confirm a smart account is owned by the Privy-linked signer (Light Account `owner()`). */
export async function assertWalletOwnedBySigner(
  walletAddress: Address,
  signerAddress: Address
): Promise<void> {
  const wallet = getAddress(walletAddress);
  const signer = getAddress(signerAddress);
  if (wallet.toLowerCase() === signer.toLowerCase()) return;

  const client = createPublicClient({
    chain,
    transport: http(getAlchemyRpcUrl())
  });

  const bytecode = await client.getBytecode({ address: wallet });
  if (!bytecode || bytecode === "0x") {
    throw Object.assign(
      new Error(
        "Smart account is not deployed yet; use the Privy signer address until the first transaction."
      ),
      { status: 403 }
    );
  }

  try {
    const owner = await client.readContract({
      address: wallet,
      abi: OWNER_ABI,
      functionName: "owner"
    });
    if (getAddress(owner).toLowerCase() !== signer.toLowerCase()) {
      throw Object.assign(new Error("walletAddress is not owned by the verified Privy signer."), {
        status: 403
      });
    }
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 403) throw error;
    throw Object.assign(
      new Error("Could not verify smart-wallet ownership for walletAddress."),
      { status: 403 }
    );
  }
}
