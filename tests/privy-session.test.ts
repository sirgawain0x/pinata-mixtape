import assert from "node:assert/strict";
import { test } from "node:test";
import type { User } from "@privy-io/server-auth";
import { getAddress } from "viem";
import { getLinkedEthereumAddresses } from "../lib/privy-server";

const EMBEDDED_SIGNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

test("passkey-only Privy user with embedded wallet is accepted for session wallet lookup", () => {
  const user = {
    id: "did:privy:test-passkey-user",
    createdAt: new Date(),
    linkedAccounts: [
      {
        type: "passkey",
        credentialId: "test-credential",
        verifiedAt: new Date(),
        firstVerifiedAt: new Date(),
        latestVerifiedAt: new Date()
      },
      {
        type: "wallet",
        address: EMBEDDED_SIGNER,
        chainType: "ethereum",
        walletClientType: "privy",
        verifiedAt: new Date(),
        firstVerifiedAt: new Date(),
        latestVerifiedAt: new Date()
      }
    ],
    wallet: {
      address: EMBEDDED_SIGNER,
      chainType: "ethereum",
      walletClientType: "privy"
    }
  } as unknown as User;

  const linked = getLinkedEthereumAddresses(user);
  assert.ok(
    linked.has(getAddress(EMBEDDED_SIGNER).toLowerCase()),
    "embedded signer address should be linked for passkey users"
  );
});
