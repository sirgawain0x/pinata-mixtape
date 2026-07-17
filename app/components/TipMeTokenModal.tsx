"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  type Address
} from "viem";
import { chain, getAlchemyRpcUrl } from "../../lib/chain";
import {
  encodeApproveCall,
  encodeMintCall,
  getMeTokenHubInfo,
  METOKENS_DIAMOND
} from "../../lib/metokens";
import { sendSmartWalletCalls } from "../../lib/smart-wallet";
import { encodeExactInputSingle, quoteStableSwap } from "../../lib/swap";
import { ERC20_ABI, isUsdc, tokenSymbol, USDC_ADDRESS, UNISWAP_SWAP_ROUTER_02 } from "../../lib/tokens";
import { FundUsdcButton } from "./FundUsdcButton";

type TipMeTokenModalProps = {
  open: boolean;
  onClose: () => void;
  meTokenAddress: string;
  curatorLabel?: string;
};

type Step = "idle" | "quoting" | "funding" | "swapping" | "approving" | "minting" | "done" | "error";

export function TipMeTokenModal({
  open,
  onClose,
  meTokenAddress,
  curatorLabel
}: TipMeTokenModalProps) {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [amountUsd, setAmountUsd] = useState("5");
  const [step, setStep] = useState<Step>("idle");
  const [status, setStatus] = useState("");
  const [hubAsset, setHubAsset] = useState<Address | null>(null);
  const [buyerAddress, setBuyerAddress] = useState<string | null>(null);
  const [txId, setTxId] = useState("");

  const signerWallet = useMemo(() => {
    const active = wallets.find((w) => w.type === "ethereum" && w.address);
    const embedded = wallets.find(
      (w) =>
        w.type === "ethereum" &&
        (w.walletClientType === "privy" || w.walletClientType === "privy-v2")
    );
    return embedded ?? active ?? null;
  }, [wallets]);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain,
        transport: http(getAlchemyRpcUrl())
      }),
    []
  );

  useEffect(() => {
    if (!open) {
      setStep("idle");
      setStatus("");
      setTxId("");
      return;
    }
    void (async () => {
      try {
        if (!METOKENS_DIAMOND) {
          setStatus("NEXT_PUBLIC_METOKENS_DIAMOND is not configured.");
          setStep("error");
          return;
        }
        const info = await getMeTokenHubInfo(getAddress(meTokenAddress));
        setHubAsset(info.asset);
        setStatus(`Hub collateral: ${tokenSymbol(info.asset)}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not load meToken hub.");
        setStep("error");
      }
    })();
  }, [open, meTokenAddress]);

  useEffect(() => {
    if (!open || !signerWallet) {
      setBuyerAddress(null);
      return;
    }
    void (async () => {
      try {
        const { resolveSmartAccountAddress } = await import("../../lib/smart-wallet");
        const address = await resolveSmartAccountAddress(signerWallet);
        setBuyerAddress(address);
      } catch {
        setBuyerAddress(signerWallet.address);
      }
    })();
  }, [open, signerWallet]);

  const handleBuy = async () => {
    if (!authenticated) {
      login();
      return;
    }
    if (!signerWallet || !buyerAddress || !hubAsset) {
      setStatus("Wallet not ready yet.");
      setStep("error");
      return;
    }
    if (!METOKENS_DIAMOND) {
      setStatus("NEXT_PUBLIC_METOKENS_DIAMOND is not configured.");
      setStep("error");
      return;
    }

    const usd = Number(amountUsd);
    if (!Number.isFinite(usd) || usd <= 0) {
      setStatus("Enter a positive USD amount.");
      setStep("error");
      return;
    }

    try {
      setStep("quoting");
      setStatus("Checking balances…");
      const amountIn = parseUnits(usd.toFixed(6), 6);
      const usdcBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [buyerAddress as Address]
      });

      if (usdcBalance < amountIn) {
        setStep("funding");
        setStatus(
          `Need ${formatUnits(amountIn, 6)} USDC. You have ${formatUnits(usdcBalance, 6)}. Use Get USDC, then try again.`
        );
        return;
      }

      const recipient = getAddress(buyerAddress);
      const meToken = getAddress(meTokenAddress);
      const diamond = getAddress(METOKENS_DIAMOND);
      let collateralAmount = amountIn;
      let collateralToken: Address = USDC_ADDRESS;

      if (!isUsdc(hubAsset)) {
        setStep("swapping");
        setStatus(`Swapping USDC → ${tokenSymbol(hubAsset)}…`);
        const quote = await quoteStableSwap(publicClient as never, {
          tokenIn: USDC_ADDRESS,
          tokenOut: hubAsset,
          amountIn
        });
        const approveRouter = encodeApproveCall({
          token: USDC_ADDRESS,
          spender: UNISWAP_SWAP_ROUTER_02,
          amount: amountIn
        });
        const swapCall = encodeExactInputSingle({
          tokenIn: USDC_ADDRESS,
          tokenOut: hubAsset,
          fee: quote.fee,
          recipient,
          amountIn,
          amountOutMinimum: quote.amountOutMinimum
        });
        const before = await publicClient.readContract({
          address: hubAsset,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [recipient]
        });
        await sendSmartWalletCalls(signerWallet, [approveRouter, swapCall]);
        const after = await publicClient.readContract({
          address: hubAsset,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [recipient]
        });
        const received = after > before ? after - before : quote.amountOutMinimum;
        collateralAmount = received > BigInt(0) ? received : quote.amountOutMinimum;
        collateralToken = hubAsset;
      }

      setStep("approving");
      setStatus(`Approving ${tokenSymbol(collateralToken)} for meTokens…`);
      const approveDiamond = encodeApproveCall({
        token: collateralToken,
        spender: diamond,
        amount: collateralAmount
      });

      setStep("minting");
      setStatus("Minting curator meToken…");
      const mintCall = encodeMintCall({
        meToken,
        assetsDeposited: collateralAmount,
        recipient
      });

      const result = await sendSmartWalletCalls(signerWallet, [approveDiamond, mintCall]);
      setTxId(result.id);
      setStep("done");
      setStatus("Tip complete — meTokens minted to your wallet.");
    } catch (error) {
      setStep("error");
      setStatus(error instanceof Error ? error.message : "Tip failed.");
    }
  };

  if (!open) return null;

  return (
    <div className="tip-modal-root" role="dialog" aria-modal="true" aria-label="Tip with meToken">
      <div className="tip-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="tip-modal-panel">
        <header className="tip-modal-header">
          <div>
            <p className="eyebrow">Support curator</p>
            <h2>{curatorLabel || "Buy meToken"}</h2>
          </div>
          <button type="button" className="tip-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="tip-modal-address">
          meToken <code>{meTokenAddress.slice(0, 8)}…{meTokenAddress.slice(-6)}</code>
        </p>

        <label className="tip-modal-field">
          <span>Amount (USD → USDC)</span>
          <input
            type="number"
            min="1"
            step="1"
            value={amountUsd}
            onChange={(event) => setAmountUsd(event.target.value)}
          />
        </label>

        <div className="tip-modal-actions">
          <FundUsdcButton
            destinationAddress={buyerAddress}
            paymentAmount={amountUsd}
            className="button"
          />
          <button
            type="button"
            className="button btn-led btn-led-green"
            onClick={() => void handleBuy()}
            disabled={step === "swapping" || step === "approving" || step === "minting"}
          >
            {!authenticated
              ? "Sign in to tip"
              : step === "swapping" || step === "approving" || step === "minting"
                ? "Working…"
                : "Buy meToken"}
          </button>
        </div>

        {status ? (
          <p className={step === "error" ? "tip-modal-status error" : "tip-modal-status"}>{status}</p>
        ) : null}
        {txId ? (
          <p className="tip-modal-status muted">
            Bundle <code>{txId.slice(0, 18)}…</code>
          </p>
        ) : null}

        <ol className="tip-steps">
          <li className={step === "funding" ? "active" : ""}>Fund USDC (Coinbase)</li>
          <li className={step === "swapping" ? "active" : ""}>Swap if hub uses USDS/GHO</li>
          <li className={step === "approving" || step === "minting" ? "active" : ""}>
            Approve + mint meToken
          </li>
          <li className={step === "done" ? "active" : ""}>Done</li>
        </ol>
      </div>
    </div>
  );
}
