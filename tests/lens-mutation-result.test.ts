import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertLensMutationNotWillFail,
  completeDelegableLensMutation,
  completeLensReactionResult,
  isLensTransactionRequest,
  readLensMutationTxHash,
} from "../lib/lens-mutation-result";

test("isLensTransactionRequest matches only Sponsored and SelfFunded requests", () => {
  assert.equal(isLensTransactionRequest({ __typename: "PostResponse", hash: "0x" + "a".repeat(64) }), false);
  assert.equal(isLensTransactionRequest({ __typename: "AddReactionResponse", success: true }), false);
  assert.equal(
    isLensTransactionRequest({
      __typename: "SponsoredTransactionRequest",
      raw: { value: "0", customData: { paymasterParams: { paymaster: "0x1" } } },
    }),
    true
  );
  assert.equal(isLensTransactionRequest({ __typename: "SelfFundedTransactionRequest" }), true);
});

test("TransactionWillFail is rejected before wallet submission", () => {
  assert.throws(
    () => assertLensMutationNotWillFail({ __typename: "TransactionWillFail", reason: "Insufficient balance" }),
    /Insufficient balance/
  );
});

test("completeDelegableLensMutation returns immediate PostResponse hash", async () => {
  const hash = "0x" + "b".repeat(64);
  const resolved = await completeDelegableLensMutation({ __typename: "PostResponse", hash }, async () => {
    throw new Error("wallet should not be called");
  });
  assert.equal(resolved, hash);
});

test("completeDelegableLensMutation routes SponsoredTransactionRequest to submit", async () => {
  const resolved = await completeDelegableLensMutation(
    { __typename: "SponsoredTransactionRequest", raw: { value: "0" } },
    async () => "0x" + "c".repeat(64)
  );
  assert.equal(resolved.length, 66);
});

test("completeLensReactionResult handles AddReactionResponse and failures", () => {
  assert.doesNotThrow(() => completeLensReactionResult({ __typename: "AddReactionResponse", success: true }));
  assert.doesNotThrow(() => completeLensReactionResult({ __typename: "UndoReactionResponse", success: true }));
  assert.throws(
    () => completeLensReactionResult({ __typename: "AddReactionFailure", reason: "Already hyped" }),
    /Already hyped/
  );
  assert.throws(
    () => completeLensReactionResult({ __typename: "AddReactionResponse", success: false }),
    /could not save your reaction/
  );
  // Reaction graphql fragments do not include tx types; guard against mis-routing.
  assert.throws(
    () =>
      completeLensReactionResult({
        __typename: "SponsoredTransactionRequest",
        raw: { value: "0", customData: { paymasterParams: { paymaster: "0x1" } } },
      }),
    /handle it separately/
  );
});

test("readLensMutationTxHash ignores non-response typenames", () => {
  assert.equal(readLensMutationTxHash({ __typename: "AddReactionResponse", success: true }), null);
});
