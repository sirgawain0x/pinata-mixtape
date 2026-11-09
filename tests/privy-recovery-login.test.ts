import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPrivyRecoveryLogin } from "../lib/privy-recovery-login";

test("passkey + embedded wallet only does not count as recovery-ready", () => {
  assert.equal(
    hasPrivyRecoveryLogin([
      { type: "passkey" },
      { type: "wallet", walletClientType: "privy" }
    ]),
    false
  );
  assert.equal(
    hasPrivyRecoveryLogin([
      { type: "passkey" },
      { type: "wallet", walletClientType: "privy-v2" }
    ]),
    false
  );
});

test("passkey + email counts as recovery-ready", () => {
  assert.equal(
    hasPrivyRecoveryLogin([{ type: "passkey" }, { type: "email" }]),
    true
  );
});

test("passkey + external wallet counts as recovery-ready", () => {
  assert.equal(
    hasPrivyRecoveryLogin([
      { type: "passkey" },
      { type: "wallet", walletClientType: "metamask" }
    ]),
    true
  );
});

test("farcaster counts as recovery-ready", () => {
  assert.equal(
    hasPrivyRecoveryLogin([{ type: "passkey" }, { type: "farcaster" }]),
    true
  );
});
