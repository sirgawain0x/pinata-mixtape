"use client";

import { useEffect, useState } from "react";
import { createSiweMessage } from "viem/siwe";

type Creator = {
  id: number;
  walletAddress: string;
  displayName: string;
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

const APP_BASE = "/app";

async function fetchMe(): Promise<Creator | null> {
  const response = await fetch(`${APP_BASE}/api/auth/me`, { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as { creator: Creator | null };
  return data.creator;
}

export default function SignInButton({ onChange }: { onChange?: (creator: Creator | null) => void }) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchMe().then((value) => {
      setCreator(value);
      onChange?.(value);
    });
  }, [onChange]);

  async function signIn() {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No Ethereum wallet detected. Install MetaMask or a compatible wallet.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0] as `0x${string}`;
      if (!address) throw new Error("No account selected.");

      const nonceResponse = await fetch(`${APP_BASE}/api/auth/nonce`, { cache: "no-store" });
      const { nonce } = (await nonceResponse.json()) as { nonce: string };

      const domain = window.location.host;
      const uri = window.location.origin;
      const chainId = Number(await window.ethereum.request({ method: "eth_chainId" })) || 1;

      const message = createSiweMessage({
        domain,
        address,
        statement: "Sign in to Pinata Mixtape Radio.",
        uri,
        version: "1",
        chainId,
        nonce,
        issuedAt: new Date()
      });

      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message, address]
      })) as `0x${string}`;

      const verifyResponse = await fetch(`${APP_BASE}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature })
      });

      const data = (await verifyResponse.json()) as { creator?: Creator; error?: string };
      if (!verifyResponse.ok || !data.creator) {
        throw new Error(data.error ?? "Sign-in failed.");
      }

      setCreator(data.creator);
      onChange?.(data.creator);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch(`${APP_BASE}/api/auth/signout`, { method: "POST" });
      setCreator(null);
      onChange?.(null);
    } finally {
      setBusy(false);
    }
  }

  if (creator) {
    const short = `${creator.walletAddress.slice(0, 6)}…${creator.walletAddress.slice(-4)}`;
    return (
      <div className="signin">
        <span className="signin-pill">{creator.displayName || short}</span>
        <button onClick={signOut} disabled={busy} type="button">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="signin">
      <button onClick={signIn} disabled={busy} type="button">
        {busy ? "Signing in…" : "Sign in with wallet"}
      </button>
      {error ? <span className="signin-error">{error}</span> : null}
    </div>
  );
}
