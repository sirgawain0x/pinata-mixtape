import { usePrivy, useLogin, useLogout, useWallets, toViemAccount } from "@privy-io/react-auth";
import { useMutation } from "@tanstack/react-query";
import { createSmartWalletClient, alchemyWalletTransport } from "@alchemy/wallet-apis";
import { base, baseSepolia } from "viem/chains";
import type { LocalAccount } from "viem/accounts";
import { useEffect, useMemo, useState } from "react";

const key =
  (typeof process !== "undefined" ? process.env["NEXT_PUBLIC_ALCHEMY_API_KEY"] : undefined) ||
  "PLACEHOLDER_VALUE_NOT_SET";
const policyId = process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID;
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453);
const chain = chainId === 84532 ? baseSepolia : base;
const rpcUrl = `https://${chainId === 84532 ? "base-sepolia" : "base-mainnet"}.g.alchemy.com/v2/${key}`;

type SignInButtonProps = {
  onChange?: (creator: { address: string } | null) => void;
  initialCreator?: { address: string } | null;
};

export function SignInButton({ onChange, initialCreator }: SignInButtonProps) {
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    initialCreator?.address ?? null
  );
  const [isOpen, setIsOpen] = useState(false);

  const signerWallet = useMemo(() => {
    const active = wallets.find((w) => w.type === "ethereum" && w.address);
    const embedded = wallets.find(
      (w) => w.type === "ethereum" && (w.walletClientType === "privy" || w.walletClientType === "privy-v2")
    );
    return embedded ?? active ?? null;
  }, [wallets]);

  const { mutate: resolveSmartWallet, isPending } = useMutation({
    mutationFn: async () => {
      if (!signerWallet) return null;
      const account = await toViemAccount({ wallet: signerWallet });
      const transport = alchemyWalletTransport({ url: rpcUrl });
      const client = createSmartWalletClient({
        signer: account as unknown as LocalAccount,
        transport,
        chain,
        ...(policyId ? { paymaster: { policyId: policyId } } : {}),
      });
      const accountList = await client.requestAccount();
      return accountList.address ?? null;
    },
    onSuccess: (address) => {
      setSmartAccountAddress(address);
    },
    onError: (err) => {
      console.error("Smart wallet resolution failed:", err);
    },
  });

  useEffect(() => {
    if (signerWallet && authenticated) {
      resolveSmartWallet();
    }
  }, [signerWallet, authenticated, resolveSmartWallet]);

  useEffect(() => {
    onChange?.(smartAccountAddress ? { address: smartAccountAddress } : null);
  }, [smartAccountAddress, onChange]);

  const handleLogout = async () => {
    await logout();
    setSmartAccountAddress(null);
    setIsOpen(false);
  };

  const displayAddress =
    smartAccountAddress ??
    signerWallet?.address ??
    user?.wallet?.address ??
    null;

  if (!ready) {
    return (
      <button className="btn-led" disabled>
        Loading…
      </button>
    );
  }

  if (authenticated) {
    return (
      <div className="relative inline-block">
        <button
          className="btn-led"
          onClick={() => setIsOpen((v) => !v)}
          disabled={isPending}
        >
          {isPending && !displayAddress
            ? "Connecting…"
            : displayAddress
              ? `My Account ${displayAddress.slice(0, 6)}…${displayAddress.slice(-4)}`
              : "My Account"}
        </button>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              aria-hidden="true"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-48 rounded border border-[var(--line)] bg-[var(--panel)] p-2 shadow-lg z-50">
              <button
                className="btn-led w-full"
                onClick={() => void handleLogout()}
              >
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button className="btn-led" onClick={() => login()} disabled={isPending}>
      {isPending ? "Connecting…" : "Sign In"}
    </button>
  );
}

export default SignInButton;
