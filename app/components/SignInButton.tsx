"use client";

import { usePrivy, useLogin, useLogout, useWallets } from "@privy-io/react-auth";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { isAddress } from "viem";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveSmartAccountAddress } from "../../lib/smart-wallet";

const APP_BASE = "/app";

type SignInButtonProps = {
  onChange?: (creator: { address: string; authenticated: boolean } | null) => void;
  initialCreator?: { address: string } | null;
  onNewTape?: () => void;
  onTipOwnMeToken?: (meTokenAddress: string) => void;
};

export function SignInButton({
  onChange,
  initialCreator,
  onNewTape,
  onTipOwnMeToken
}: SignInButtonProps) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    initialCreator?.address ?? null
  );
  const [isOpen, setIsOpen] = useState(false);
  const [panel, setPanel] = useState<"menu" | "metoken">("menu");
  const [meTokenInput, setMeTokenInput] = useState("");
  const [meTokenSaved, setMeTokenSaved] = useState("");
  const [meTokenStatus, setMeTokenStatus] = useState("");
  const [meTokenSaving, setMeTokenSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sessionAddressRef = useRef<string | null>(null);

  const signerWallet = useMemo(() => {
    const active = wallets.find((w) => w.type === "ethereum" && w.address);
    const embedded = wallets.find(
      (w) =>
        w.type === "ethereum" &&
        (w.walletClientType === "privy" || w.walletClientType === "privy-v2")
    );
    return embedded ?? active ?? null;
  }, [wallets]);

  const displayAddress =
    smartAccountAddress ??
    signerWallet?.address ??
    user?.wallet?.address ??
    null;

  const { mutate: resolveSmartWallet, isPending } = useMutation({
    mutationFn: async () => {
      if (!signerWallet) return null;
      return resolveSmartAccountAddress(signerWallet);
    },
    onSuccess: (address) => {
      setSmartAccountAddress(address);
    },
    onError: (err) => {
      console.error("Smart wallet resolution failed:", err);
    }
  });

  const syncSession = useCallback(
    async (walletAddress: string) => {
      if (sessionAddressRef.current === walletAddress.toLowerCase()) return;
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const response = await fetch(`${APP_BASE}/api/auth/session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ walletAddress })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        console.error("Session sync failed:", data?.error || response.status);
        return;
      }
      sessionAddressRef.current = walletAddress.toLowerCase();
      setSessionReady(true);
      const data = (await response.json()) as {
        creator?: { meTokenAddress?: string };
      };
      if (data.creator?.meTokenAddress) {
        setMeTokenSaved(data.creator.meTokenAddress);
        setMeTokenInput(data.creator.meTokenAddress);
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    if (signerWallet && authenticated) {
      resolveSmartWallet();
    }
  }, [signerWallet, authenticated, resolveSmartWallet]);

  useEffect(() => {
    if (!authenticated) {
      onChange?.(null);
      setSessionReady(false);
      sessionAddressRef.current = null;
      return;
    }
    if (displayAddress) {
      onChange?.({ address: displayAddress, authenticated: true });
    } else {
      onChange?.({ address: "", authenticated: true });
    }
  }, [authenticated, displayAddress, onChange]);

  useEffect(() => {
    if (!authenticated || !displayAddress || !isAddress(displayAddress)) return;
    void syncSession(displayAddress);
  }, [authenticated, displayAddress, syncSession]);

  useEffect(() => {
    if (!isOpen || !sessionReady) return;
    void (async () => {
      const response = await fetch(`${APP_BASE}/api/creators/me`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as {
        creator?: { meTokenAddress?: string };
      };
      if (data.creator?.meTokenAddress) {
        setMeTokenSaved(data.creator.meTokenAddress);
        setMeTokenInput(data.creator.meTokenAddress);
      }
    })();
  }, [isOpen, sessionReady]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setPanel("menu");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleLogout = async () => {
    await fetch(`${APP_BASE}/api/auth/session`, { method: "DELETE" }).catch(() => null);
    await logout();
    setSmartAccountAddress(null);
    setIsOpen(false);
    setPanel("menu");
    setSessionReady(false);
    sessionAddressRef.current = null;
    onChange?.(null);
  };

  const handleCopy = async () => {
    if (!displayAddress) return;
    try {
      await navigator.clipboard.writeText(displayAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleSaveMeToken = async () => {
    const value = meTokenInput.trim();
    if (value && !isAddress(value)) {
      setMeTokenStatus("Enter a valid 0x address.");
      return;
    }
    setMeTokenSaving(true);
    setMeTokenStatus("");
    try {
      const response = await fetch(`${APP_BASE}/api/creators/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meTokenAddress: value || null })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        creator?: { meTokenAddress?: string };
      } | null;
      if (!response.ok) {
        setMeTokenStatus(data?.error || "Could not save meToken.");
        return;
      }
      const saved = data?.creator?.meTokenAddress || "";
      setMeTokenSaved(saved);
      setMeTokenInput(saved);
      setMeTokenStatus(saved ? "Saved." : "Cleared.");
    } finally {
      setMeTokenSaving(false);
    }
  };

  if (!ready) {
    return (
      <button className="btn-led" type="button" disabled>
        Loading…
      </button>
    );
  }

  if (authenticated) {
    const short =
      displayAddress && displayAddress.length > 10
        ? `${displayAddress.slice(0, 6)}…${displayAddress.slice(-4)}`
        : displayAddress || "My Account";

    return (
      <div className="account-menu" ref={menuRef}>
        <button
          className="btn-led account-menu-trigger"
          onClick={() => {
            setIsOpen((v) => !v);
            setPanel("menu");
          }}
          disabled={isPending && !displayAddress}
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          {isPending && !displayAddress ? "Connecting…" : `My Account ${short}`}
        </button>
        {isOpen ? (
          <>
            <div
              className="account-menu-backdrop"
              aria-hidden="true"
              onClick={() => {
                setIsOpen(false);
                setPanel("menu");
              }}
            />
            <div className="account-menu-panel" role="menu">
              {panel === "menu" ? (
                <>
                  <div className="account-menu-header">
                    <span className="account-menu-label">Wallet</span>
                    <button
                      type="button"
                      className="account-menu-address"
                      onClick={() => void handleCopy()}
                      title={displayAddress || undefined}
                    >
                      {displayAddress || "Resolving smart wallet…"}
                      {copied ? <em>Copied</em> : null}
                    </button>
                  </div>
                  <div className="account-menu-actions">
                    {onNewTape ? (
                      <button
                        type="button"
                        className="account-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setIsOpen(false);
                          onNewTape();
                        }}
                      >
                        New tape
                      </button>
                    ) : null}
                    <Link
                      className="account-menu-item"
                      href="/dashboard"
                      role="menuitem"
                      onClick={() => setIsOpen(false)}
                    >
                      Host a station
                    </Link>
                    <button
                      type="button"
                      className="account-menu-item"
                      role="menuitem"
                      onClick={() => setPanel("metoken")}
                    >
                      meToken settings
                    </button>
                    {meTokenSaved && onTipOwnMeToken ? (
                      <button
                        type="button"
                        className="account-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setIsOpen(false);
                          onTipOwnMeToken(meTokenSaved);
                        }}
                      >
                        Tip my meToken
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="account-menu-item account-menu-item-danger"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                    >
                      Log out
                    </button>
                  </div>
                </>
              ) : (
                <div className="account-metoken">
                  <button
                    type="button"
                    className="account-menu-back"
                    onClick={() => setPanel("menu")}
                  >
                    ← Back
                  </button>
                  <p className="account-menu-label">Your meToken address</p>
                  <p className="account-metoken-help">
                    Fans can tip you by buying this meToken with USDC (or swapped USDS/GHO).
                  </p>
                  <input
                    className="account-metoken-input"
                    value={meTokenInput}
                    onChange={(event) => setMeTokenInput(event.target.value)}
                    placeholder="0x…"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn-led account-metoken-save"
                    disabled={meTokenSaving}
                    onClick={() => void handleSaveMeToken()}
                  >
                    {meTokenSaving ? "Saving…" : "Save meToken"}
                  </button>
                  {meTokenStatus ? (
                    <p className="account-metoken-status">{meTokenStatus}</p>
                  ) : null}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <button className="btn-led" onClick={() => login()} disabled={isPending} type="button">
      {isPending ? "Connecting…" : "Sign In"}
    </button>
  );
}

export default SignInButton;
