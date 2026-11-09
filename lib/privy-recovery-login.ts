/** Minimal linked-account fields needed to decide if the user can recover without their passkey device. */
export type RecoveryLoginLinkedAccount = {
  type: string;
  walletClientType?: string | null;
};

const EMBEDDED_WALLET_CLIENT_TYPES = new Set(["privy", "privy-v2"]);

function isExternalWalletAccount(account: RecoveryLoginLinkedAccount): boolean {
  if (account.type !== "wallet") return false;
  const client = account.walletClientType?.toLowerCase();
  if (!client) return true;
  return !EMBEDDED_WALLET_CLIENT_TYPES.has(client);
}

/**
 * True when the Privy user has a login method besides passkey that can recover access
 * (email, Google, Farcaster, or an external wallet — not the Privy embedded wallet).
 */
export function hasPrivyRecoveryLogin(
  linkedAccounts: readonly RecoveryLoginLinkedAccount[] | null | undefined
): boolean {
  if (!linkedAccounts?.length) return false;
  return linkedAccounts.some(
    (account) =>
      account.type === "email" ||
      account.type === "google_oauth" ||
      account.type === "farcaster" ||
      isExternalWalletAccount(account)
  );
}
