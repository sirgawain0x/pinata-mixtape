import assert from "node:assert/strict";
import { test } from "node:test";
import { MIXTAPE_PRIVY_LOGIN_METHODS } from "../lib/privy-client-config";

test("Mixtape Privy login methods include passkey alongside existing methods", () => {
  const methods = [...MIXTAPE_PRIVY_LOGIN_METHODS];
  for (const expected of ["email", "wallet", "farcaster", "google", "passkey"] as const) {
    assert.ok(
      methods.includes(expected),
      `expected loginMethods to include ${expected}, got ${methods.join(", ")}`
    );
  }
});
