import type { ConnectedWallet } from "@privy-io/react-auth";
import type { WalletClient } from "viem";
import { handleOperationWith } from "@lens-protocol/client/viem";
import { assertFreeLensOperation, asLensOperation, type LensTieredOperation } from "./lens-operation";
import { switchWalletToLensChain } from "./lens-wallet";

export async function submitLensOperation(
  operationInput: unknown,
  wallet: WalletClient,
  connected: ConnectedWallet,
  lensChainId: number
): Promise<string> {
  const operation = asLensOperation(operationInput);
  if (!operation) throw new Error("Lens did not return a transaction to sign.");
  assertFreeLensOperation(operation);
  if (operation.__typename === "SponsoredTransactionRequest") {
    await switchWalletToLensChain(connected, lensChainId);
  }
  // SDK tiered results are wider than our gas guard shape.
  const handled = await handleOperationWith(wallet)(operation as Parameters<ReturnType<typeof handleOperationWith>>[0]);
  if (handled.isErr()) throw handled.error;
  return handled.value;
}
