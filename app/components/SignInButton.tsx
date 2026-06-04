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

function siweDomain(): string {
  const configured = process.env.NEXT_PUBLIC_SIWE_DOMAIN?.trim();
  if (configured) {
    return configured.includes("://") ? new URL(configured).host : configured;
  }
  return window.location.host;
}

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
  const [siweBlocked, setSiweBlocked] = useState(false);

  const signerStatus = useSignerStatus();
  const { client } = useSmartAccountClient({});
  const { signMessageAsync } = useSignMessage({ client });
  const { openAuthModal } = useAuthModal();
  const { logout } = useLogout();

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const signMessageAsyncRef = useRef(signMessageAsync);
  signMessageAsyncRef.current = signMessageAsync;

  const address = client?.account?.address as `0x${string}` | undefined;
  const chainId = client?.chain?.id;

  useEffect(() => {
    void fetchMe().then((value) => {
      setCreator(value);
      onChangeRef.current?.(value);
    });
  }, []);

  useEffect(() => {
    if (!signerStatus.isConnected) setSiweBlocked(false);
  }, [signerStatus.isConnected]);

  const inFlightRef = useRef(false);
  useEffect(() => {
    if (creator) return;
    if (siweBlocked) return;
    if (!signerStatus.isConnected) return;
    if (!address || !chainId) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setBusy(true);
    setError("");

    (async () => {
      try {
        const nonceResponse = await fetch(`${APP_BASE}/api/auth/nonce`, { cache: "no-store" });
        if (!nonceResponse.ok) {
          throw new Error(
            nonceResponse.status >= 500
              ? "Server error while starting sign-in. Use Retry when the app is ready, or try again later."
              : `Could not start sign-in (${nonceResponse.status}).`
          );
        }
        const nonceBody = (await nonceResponse.json()) as { nonce?: string };
        if (!nonceBody.nonce) {
          throw new Error("Invalid response from sign-in server.");
        }
        const { nonce } = nonceBody;

        const message = createSiweMessage({
          domain: siweDomain(),
          address,
          statement: "Sign in to Mixtape Radio.",
          uri: window.location.origin,
          version: "1",
          chainId,
          nonce,
          issuedAt: new Date()
        });

        const signature = await signMessageAsyncRef.current({ message });

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
        onChangeRef.current?.(data.creator);
      } catch (err) {
        setError((err as Error).message);
        setSiweBlocked(true);
      } finally {
        setBusy(false);
        inFlightRef.current = false;
      }
    })();
  }, [creator, signerStatus.isConnected, siweBlocked, address, chainId]);

  function handlePrimaryClick() {
    setError("");
    setSiweBlocked(false);
    if (!signerStatus.isConnected) openAuthModal();
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch(`${APP_BASE}/api/auth/signout`, { method: "POST" });
      logout();
      setCreator(null);
      onChangeRef.current?.(null);
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
    : signerStatus.isConnected && siweBlocked
    ? "Retry sign-in"
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
        onClick={handlePrimaryClick}
        disabled={busy || signerStatus.isInitializing}
        type="button"
      >
        {buttonLabel}
      </button>
      {error ? <span className="signin-error">{error}</span> : null}
    </div>
  );
}
