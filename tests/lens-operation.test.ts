import test from "node:test";
import assert from "node:assert/strict";
import { isLensTransactionRequest } from "../lib/lens-mutation-result";
import { assertFreeLensOperation } from "../lib/lens-operation";

test("paid fallback is blocked before a wallet adapter can send it", () => {
  let walletCalled = false;
  assert.throws(() => {
    assertFreeLensOperation({ __typename: "SelfFundedTransactionRequest" });
    walletCalled = true;
  }, /no payment was submitted/);
  assert.equal(walletCalled, false);
});

test("sponsored transaction requests pass the gas guard", () => {
  assert.doesNotThrow(() =>
    assertFreeLensOperation({
      __typename: "SponsoredTransactionRequest",
      raw: { value: "0", customData: { paymasterParams: { paymaster: "0xpaymaster" } } },
    })
  );
});

test("PostResponse is not treated as a wallet transaction request", () => {
  assert.equal(isLensTransactionRequest({ __typename: "PostResponse", hash: "0x" + "a".repeat(64) }), false);
  assert.equal(isLensTransactionRequest(null), false);
});

test("sponsored requests cannot carry a payment or omit their paymaster", () => {
  assert.throws(() => assertFreeLensOperation({ __typename: "SponsoredTransactionRequest", raw: { value: "1", customData: { paymasterParams: { paymaster: "0xpaymaster" } } } }), /No payment/);
  assert.throws(() => assertFreeLensOperation({ __typename: "SponsoredTransactionRequest", raw: { value: "0" } }), /No payment/);
});
