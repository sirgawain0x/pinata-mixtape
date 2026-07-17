"use client";

import { useState } from "react";

const APP_BASE = "/app";

type FundUsdcButtonProps = {
  destinationAddress: string | null;
  paymentAmount?: string;
  className?: string;
  label?: string;
};

export function FundUsdcButton({
  destinationAddress,
  paymentAmount,
  className,
  label = "Get USDC"
}: FundUsdcButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFund = async () => {
    if (!destinationAddress) {
      setError("Connect your wallet first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${APP_BASE}/api/onramp/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationAddress,
          paymentAmount,
          redirectUrl: typeof window !== "undefined" ? window.location.href : undefined
        })
      });
      const data = (await response.json().catch(() => null)) as {
        onrampUrl?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.onrampUrl) {
        setError(data?.error || "Could not start Coinbase onramp.");
        return;
      }
      window.open(data.onrampUrl, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fund-usdc">
      <button
        type="button"
        className={className || "btn-led"}
        disabled={loading || !destinationAddress}
        onClick={() => void handleFund()}
      >
        {loading ? "Opening…" : label}
      </button>
      {error ? <p className="fund-usdc-error">{error}</p> : null}
    </div>
  );
}
