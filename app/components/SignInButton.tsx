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
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    initialCreator?.address ?? null
  );

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
  };

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
        onClick={() => void handleLogout()}
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
