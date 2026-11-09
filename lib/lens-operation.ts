export type LensTieredOperation = { __typename: string; raw?: unknown };

/** Reject operations that could spend the user's funds before invoking a wallet adapter. */
export function assertFreeLensOperation(operation: LensTieredOperation): void {
  if (operation.__typename === "SelfFundedTransactionRequest") {
    throw new Error("Lens requested a paid transaction. Publishing stopped; no payment was submitted.");
  }
  if (operation.__typename === "SponsoredTransactionRequest") {
    const raw = operation.raw as { value?: string; customData?: { paymasterParams?: { paymaster?: string } } } | undefined;
    if (!raw || !raw.customData?.paymasterParams?.paymaster || !raw.value || !/^(0|0x0+)$/i.test(raw.value)) {
      throw new Error("Lens did not provide a zero-value sponsored transaction. No payment was submitted.");
    }
  }
}
