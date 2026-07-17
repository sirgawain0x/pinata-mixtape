"use client";

import { createSmartWalletClient, alchemyWalletTransport } from "@alchemy/wallet-apis";
import { toViemAccount, type ConnectedWallet } from "@privy-io/react-auth";
import type { LocalAccount } from "viem/accounts";
import { alchemyPolicyId, chain, getAlchemyRpcUrl } from "./chain";

export async function createAlchemySmartWalletClient(signerWallet: ConnectedWallet) {
  const account = await toViemAccount({ wallet: signerWallet });
  const transport = alchemyWalletTransport({ url: getAlchemyRpcUrl() });
  return createSmartWalletClient({
    signer: account as unknown as LocalAccount,
    transport,
    chain,
    ...(alchemyPolicyId ? { paymaster: { policyId: alchemyPolicyId } } : {})
  });
}

export async function resolveSmartAccountAddress(
  signerWallet: ConnectedWallet
): Promise<string | null> {
  const client = await createAlchemySmartWalletClient(signerWallet);
  const accountList = await client.requestAccount();
  return accountList.address ?? null;
}

export type CallRequest = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
};

export async function sendSmartWalletCalls(
  signerWallet: ConnectedWallet,
  calls: CallRequest[]
): Promise<{ id: string }> {
  const client = await createAlchemySmartWalletClient(signerWallet);
  const account = await client.requestAccount();
  const result = await client.sendCalls({
    account: account.address,
    calls: calls.map((call) => ({
      to: call.to,
      data: call.data,
      value: call.value ?? BigInt(0)
    })),
    ...(alchemyPolicyId
      ? { capabilities: { paymaster: { policyId: alchemyPolicyId } } }
      : {})
  });

  if (typeof client.waitForCallsStatus !== "function") {
    throw new Error("Smart wallet client cannot confirm transaction status.");
  }

  const status = await client.waitForCallsStatus({ id: result.id });
  const outcome =
    typeof status === "object" && status && "status" in status
      ? String((status as { status?: string }).status)
      : "";
  if (outcome === "failure" || outcome === "reverted") {
    throw new Error("Smart wallet transaction failed.");
  }

  return { id: result.id };
}
