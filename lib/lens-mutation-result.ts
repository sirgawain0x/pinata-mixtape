import { isTransactionRequest } from "@lens-protocol/client";
import type { LensTieredOperation } from "./lens-operation";

function readTypename(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const typename = (value as { __typename?: unknown }).__typename;
  return typeof typename === "string" ? typename : null;
}

function readReason(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const reason = (value as { reason?: unknown }).reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : undefined;
}

/** Only Lens tiered transaction requests that may be signed in the wallet. */
export function isLensTransactionRequest(value: unknown): value is LensTieredOperation {
  return !!value && typeof value === "object" && isTransactionRequest(value as { __typename: string });
}

export function assertLensMutationNotWillFail(value: unknown): void {
  if (readTypename(value) === "TransactionWillFail") {
    throw new Error(readReason(value) || "Lens reported this transaction would fail.");
  }
}

export function assertLensPostValidationPassed(value: unknown): void {
  if (readTypename(value) === "PostOperationValidationFailed") {
    throw new Error(readReason(value) || "Lens could not validate this post.");
  }
}

export function readLensMutationTxHash(value: unknown): string | null {
  const typename = readTypename(value);
  if (typename !== "PostResponse" && typename !== "DeletePostResponse") return null;
  const hash = (value as { hash?: unknown }).hash;
  return typeof hash === "string" && /^0x[0-9a-f]{64}$/i.test(hash) ? hash : null;
}

/**
 * Resolve post/edit/delete mutation results: immediate hash, validation errors,
 * or a wallet transaction via `submitTransaction`.
 */
export async function completeDelegableLensMutation(
  value: unknown,
  submitTransaction: () => Promise<string>
): Promise<string> {
  assertLensMutationNotWillFail(value);
  assertLensPostValidationPassed(value);
  const immediate = readLensMutationTxHash(value);
  if (immediate) return immediate;
  if (isLensTransactionRequest(value)) return submitTransaction();
  throw new Error("Lens returned an unexpected result.");
}

/** Canary `addReaction` / `undoReaction` return AddReactionResponse | AddReactionFailure (no tx fragment). */
export function completeLensReactionResult(value: unknown): void {
  const typename = readTypename(value);
  if (typename === "AddReactionFailure" || typename === "UndoReactionFailure") {
    throw new Error(readReason(value) || "Lens could not save your reaction.");
  }
  if (typename === "AddReactionResponse" || typename === "UndoReactionResponse") {
    if ((value as { success?: boolean }).success !== true) {
      throw new Error("Lens could not save your reaction.");
    }
    return;
  }
  if (isLensTransactionRequest(value)) {
    throw new Error("Lens reaction returned a transaction request; handle it separately.");
  }
  throw new Error("Lens returned an unexpected reaction result.");
}
