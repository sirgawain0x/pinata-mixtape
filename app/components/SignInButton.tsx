"use client";

import { useEffect, useRef, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import {
  useAuthModal,
  useLogout,
  useSignMessage,
  useSignerStatus,
  useSmartAccountClient
} from "@account-kit/react";

type Creator = {
  id: number;
  walletAddress: string;
  displayName: string;
};

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

  const signerStatus = useSignerStatus();
  const { client } = useSmartAccountClient({});
  const { signMessageAsync } = useSignMessage({ client });
  const { openAuthModal } = useAuthModal();
  const { logout } = useLogout();

  // 1) On mount, see if there's an existing server session.
  useEffect(() => {
    void fetchMe().then((value) => {
      setCreator(value);
      onChange?.(value);
    });
  }, [onChange]);

  // 2) Once Account Kit is connected and the smart-account client is ready,
  //    run the SIWE handshake against our server (if we don't already have a session).
  const inFlightRef = useRef(false);
  useEffect(() => {
    if (creator) return;
    if (!signerStatus.isConnected) return;
    const address = client?.account?.address as `0x${string}` | undefined;
    const chainId = client?.chain?.id;
    if (!address || !chainId) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setBusy(true);
    setError("");

    (async () => {
      try {
        const nonceResponse = await fetch(`${APP_BASE}/api/auth/nonce`, { cache: "no-store" });
        const { nonce } = (await nonceResponse.json()) as { nonce: string };

        const message = createSiweMessage({
          domain: window.location.host,
          address,
          statement: "Sign in to Pinata Mixtape Radio.",
          uri: window.location.origin,
          version: "1",
          chainId,
          nonce,
          issuedAt: new Date()
        });

        // Account Kit returns an ERC-1271 (deployed) or ERC-6492 (counterfactual)
        // signature for smart accounts, and a regular ECDSA sig for EOA logins.
        const signature = await signMessageAsync({ message });

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
        inFlightRef.current = false;
      }
    })();
  }, [creator, client, signerStatus.isConnected, signMessageAsync, onChange]);

  async function signOut() {
    setBusy(true);
    try {
      // Clear our server session first so /api/auth/me returns null on refresh.
      await fetch(`${APP_BASE}/api/auth/signout`, { method: "POST" });
      // Then disconnect the Account Kit signer (clears its cookie too).
      logout();
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

  const buttonLabel = busy
    ? "Signing in…"
    : signerStatus.isConnected
    ? "Finalizing…"
    : signerStatus.isAuthenticating
    ? "Authenticating…"
    : signerStatus.isInitializing
    ? "Loading…"
    : "Sign in";

  return (
    <div className="signin">
      <button
        onClick={openAuthModal}
        disabled={busy || signerStatus.isInitializing}
        type="button"
      >
        {buttonLabel}
      </button>
      {error ? <span className="signin-error">{error}</span> : null}
    </div>
  );
}
