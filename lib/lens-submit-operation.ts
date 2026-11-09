import type { ConnectedWallet } from "@privy-io/react-auth";
import type { WalletClient } from "viem";
import { handleOperationWith } from "@lens-protocol/client/viem";
import { isLensTransactionRequest } from "./lens-mutation-result";
import { assertFreeLensOperation, type LensTieredOperation } from "./lens-operation";
import { switchWalletToLensChain } from "./lens-wallet";

export async function submitLensOperation(
  operationInput: unknown,
  wallet: WalletClient,
  connected: ConnectedWallet,
  lensChainId: number
): Promise<string> {
  if (!isLensTransactionRequest(operationInput)) {
    throw new Error("Lens did not return a transaction to sign.");
  }
  const operation = operationInput;
  assertFreeLensOperation(operation);
  if (operation.__typename === "SponsoredTransactionRequest") {
    await switchWalletToLensChain(connected, lensChainId);
  }
  // SDK tiered results are wider than our gas guard shape.
  const handled = await handleOperationWith(wallet)(operation as Parameters<ReturnType<typeof handleOperationWith>>[0]);
  if (handled.isErr()) throw handled.error;
  return handled.value;
}
