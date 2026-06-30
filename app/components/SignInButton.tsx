"use client";

import { usePrivy, useLogin, useLogout, useWallets, toViemAccount } from "@privy-io/react-auth";
import { useMutation } from "@tanstack/react-query";
import { createSmartWalletClient, alchemyWalletTransport } from "@alchemy/wallet-apis";
import { base, baseSepolia } from "viem/chains";
import type { LocalAccount } from "viem/accounts";
import { useEffect, useMemo, useState } from "react";

const API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "missing-alchemy-api-key";
const POLICY_ID = process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453);
const chain = CHAIN_ID === 84532 ? baseSepolia : base;

type SignInButtonProps = {
  onChange?: (creator: { address: string } | null) => void;
  initialCreator?: { address: string } | null;
};

export function SignInButton({ onChange, initialCreator }: SignInButtonProps) {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    initialCreator?.address ?? null
  );

  const signerWallet = useMemo(() => {
    return (
      wallets.find(
        (w) =>
          w.type === "ethereum" &&
          (w.walletClientType === "privy" || w.walletClientType === "privy-v2")
      ) ?? null
    );
  }, [wallets]);

  // Create / refresh the Alchemy smart wallet whenever the embedded wallet changes.
  const { mutate: resolveSmartWallet, isPending } = useMutation({
    mutationFn: async () => {
      if (!signerWallet) return null;
      const account = await toViemAccount({ wallet: signerWallet });
      const transport = alchemyWalletTransport({ apiKey: API_KEY });
      const client = createSmartWalletClient({
        signer: account as unknown as LocalAccount,
        transport,
        chain,
        ...(POLICY_ID ? { paymaster: { policyId: POLICY_ID } } : {}),
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

  if (!ready) {
    return (
      <button className="btn-led" disabled>
        Loading…
      </button>
    );
  }

  if (authenticated && smartAccountAddress) {
    return (
      <button
        className="btn-led"
        onClick={() => logout()}
        disabled={isPending}
      >
        {isPending ? "Connecting…" : `Signed in ${smartAccountAddress.slice(0, 6)}…${smartAccountAddress.slice(-4)}`}
      </button>
    );
  }

  return (
    <button className="btn-led" onClick={() => login()} disabled={isPending}>
      {isPending ? "Connecting…" : "Sign In"}
    </button>
  );
}

export default SignInButton;
