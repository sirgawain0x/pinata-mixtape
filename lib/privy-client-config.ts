/** Privy `loginMethods` shared between the app provider and tests. */
export const MIXTAPE_PRIVY_LOGIN_METHODS = [
  "email",
  "wallet",
  "farcaster",
  "google",
  "passkey"
] as const;

export type MixtapePrivyLoginMethod = (typeof MIXTAPE_PRIVY_LOGIN_METHODS)[number];
