import test from "node:test";
import assert from "node:assert/strict";
import { assertFreeLensOperation, asLensOperation } from "../lib/lens-operation";

test("paid fallback is blocked before a wallet adapter can send it", () => {
  let walletCalled = false;
  assert.throws(() => {
    assertFreeLensOperation({ __typename: "SelfFundedTransactionRequest" });
    walletCalled = true;
  }, /no payment was submitted/);
  assert.equal(walletCalled, false);
});

test("relay responses and sponsored signatures may proceed", () => {
  assert.doesNotThrow(() => assertFreeLensOperation({ __typename: "PostResponse" }));
  assert.doesNotThrow(() => assertFreeLensOperation({ __typename: "SponsoredTransactionRequest", raw: { value: "0", customData: { paymasterParams: { paymaster: "0xpaymaster" } } } }));
});

test("asLensOperation only accepts tiered transaction shapes", () => {
  assert.equal(asLensOperation(null), null);
  assert.equal(asLensOperation(true), null);
  assert.deepEqual(asLensOperation({ __typename: "PostResponse" }), { __typename: "PostResponse" });
});

test("sponsored requests cannot carry a payment or omit their paymaster", () => {
  assert.throws(() => assertFreeLensOperation({ __typename: "SponsoredTransactionRequest", raw: { value: "1", customData: { paymasterParams: { paymaster: "0xpaymaster" } } } }), /No payment/);
  assert.throws(() => assertFreeLensOperation({ __typename: "SponsoredTransactionRequest", raw: { value: "0" } }), /No payment/);
});
