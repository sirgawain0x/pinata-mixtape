import assert from "node:assert/strict";
import { test } from "node:test";
import { assertFreeLensOperation, asLensOperation } from "../lib/lens-operation";
import {
  LENS_POST_MAX_CHARACTERS,
  lensPostBodyTooLarge,
  validateLensPostContent,
} from "../lib/lens-post-content";
import { requireSignedInForLensAccountLookup } from "../lib/lens-account-access";
import { switchWalletToLensChain } from "../lib/lens-wallet";

test("post content uses one Lens-safe character limit", () => {
  assert.equal(LENS_POST_MAX_CHARACTERS, 2000);
  assert.deepEqual(validateLensPostContent("a".repeat(2000)), { ok: true, content: "a".repeat(2000) });
  const over = validateLensPostContent("a".repeat(2001));
  assert.equal(over.ok, false);
  if (!over.ok) assert.equal(over.status, 400);
});

test("oversized HTTP bodies are rejected before JSON parse", () => {
  assert.equal(lensPostBodyTooLarge(12_001, 10), true);
  assert.equal(lensPostBodyTooLarge(null, 12_001), true);
  assert.equal(lensPostBodyTooLarge(100, 100), false);
});

test("reaction operations reject paid Lens transactions before signing", () => {
  const paid = asLensOperation({ __typename: "SelfFundedTransactionRequest" });
  assert.ok(paid);
  assert.throws(() => assertFreeLensOperation(paid!), /no payment was submitted/);
});

test("lens account GET requires a Mixtape session", () => {
  assert.deepEqual(requireSignedInForLensAccountLookup(false), {
    status: 401,
    message: "Sign in to view Lens account links.",
  });
  assert.equal(requireSignedInForLensAccountLookup(true), null);
});

test("switchChain rejection surfaces a clear Lens network message", async () => {
  await assert.rejects(
    () =>
      switchWalletToLensChain(
        {
          switchChain: async () => {
            throw new Error("User rejected the request.");
          },
        },
        232
      ),
    /Could not switch your wallet to Lens: User rejected the request\./
  );
});
