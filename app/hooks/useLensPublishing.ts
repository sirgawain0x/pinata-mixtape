"use client";

import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { lens } from "viem/chains";
import { evmAddress, uri, txHash, postId, PostReactionType, type SessionClient } from "@lens-protocol/client";
import { fetchAccountsAvailable, fetchPost, post, editPost, deletePost, addReaction, undoReaction, transactionStatus } from "@lens-protocol/client/actions";
import { handleOperationWith, signMessageWith } from "@lens-protocol/client/viem";
import { assertFreeLensOperation } from "../../lib/lens-operation";
import { lensClient } from "../../lib/lens-client";
import { MIXTAPE_LENS } from "../../lib/lens-config";

type PendingChange = { id: string; action: "edit" | "delete"; hash: string };

type AvailableAccount = { address: string; label: string; owner: string };

export function useLensPublishing() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [walletAddress, setWalletAddress] = useState("");
  const [accounts, setAccounts] = useState<AvailableAccount[]>([]);
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<{ client: SessionClient; wallet: Awaited<ReturnType<typeof walletClient>>; signer: string; account: string } | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [publishedId, setPublishedId] = useState("");
  const [pendingContent, setPendingContent] = useState("");
  const [pendingHash, setPendingHash] = useState<string | null>(null);

  useEffect(() => {
    try {
      const change = JSON.parse(sessionStorage.getItem("mixtape:pending-lens-change") || "null");
      if (change && /^0x[0-9a-f]{64}$/i.test(change.hash) && typeof change.id === "string" && ["edit", "delete"].includes(change.action)) setPendingChange(change);
      const saved = JSON.parse(sessionStorage.getItem("mixtape:pending-lens-post") || "null");
      if (saved && /^0x[0-9a-f]{64}$/i.test(saved.hash) && typeof saved.content === "string") {
        setPendingHash(saved.hash); setPendingContent(saved.content);
        setStatus("A post was already submitted. Check its confirmation before publishing again.");
      }
    } catch { /* Recovery storage is optional. */ }
  }, []);

  useEffect(() => {
    setSession(null);
    setAccounts([]);
    setAccount("");
  }, [authenticated, walletAddress]);

  async function walletClient() {
    const wallet = wallets.find((item) => item.address === walletAddress) || (wallets.length === 1 ? wallets[0] : undefined);
    if (!wallet) throw new Error("Connect the wallet that owns or manages your Lens account.");
    const provider = await wallet.getEthereumProvider();
    return createWalletClient({ chain: lens, account: wallet.address as `0x${string}`, transport: custom(provider) });
  }

  async function findAccounts() {
    if (!authenticated) { login(); return; }
    setBusy(true);
    try {
      const wallet = await walletClient();
      const result = await fetchAccountsAvailable(lensClient, { managedBy: evmAddress(wallet.account.address), includeOwned: true });
      if (result.isErr()) throw result.error;
      const found = result.value.items.map(({ account: item }) => ({ address: item.address, owner: item.owner, label: item.username?.value || item.address }));
      setAccounts(found);
      setAccount(found.length === 1 ? found[0].address : "");
      setStatus(found.length ? "Choose the Lens account to publish as." : "This wallet has no Lens account. Connect a wallet that owns or manages one.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not load Lens accounts."); }
    finally { setBusy(false); }
  }

  async function ensureSession() {
    const wallet = await walletClient();
    let active = session;
    if (!active || active.signer !== wallet.account.address || active.account !== account) {
      const selected = accounts.find((item) => item.address === account);
      if (!selected) throw new Error("Choose your Lens account first.");
      setStatus("Approve linking this Lens account to your Mixtape profile.");
      const linkBody = { account, signer: wallet.account.address };
      const challengeResponse = await fetch("/app/api/lens/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(linkBody) });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok) throw new Error(challenge.error || "Could not link Lens account.");
      const signature = await wallet.signMessage({ message: challenge.message });
      const linkResponse = await fetch("/app/api/lens/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...linkBody, signature }) });
      if (!linkResponse.ok) throw new Error("Could not verify your Lens account link. Try again.");
      setStatus("Approve the Lens sign-in message in your wallet.");
      const role = selected.owner.toLowerCase() === wallet.account.address.toLowerCase()
        ? { accountOwner: { app: evmAddress(MIXTAPE_LENS.app), account: evmAddress(account), owner: evmAddress(wallet.account.address) } }
        : { accountManager: { app: evmAddress(MIXTAPE_LENS.app), account: evmAddress(account), manager: evmAddress(wallet.account.address) } };
      const signedIn = await lensClient.login({ ...role, signMessage: signMessageWith(wallet) });
      if (signedIn.isErr()) throw signedIn.error;
      active = { client: signedIn.value, wallet, signer: wallet.account.address, account };
      setSession(active);
    }
    return active;
  }

  async function connect() {
    if (busy) return;
    setBusy(true);
    try { await ensureSession(); setStatus("Lens account connected to your Mixtape profile."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not connect Lens account."); }
    finally { setBusy(false); }
  }

  async function confirmPost(hash: string) {
    setStatus("Post submitted. Waiting for Lens confirmation…");
    for (let attempt = 0; attempt < 12; attempt++) {
      const confirmed = await fetchPost(lensClient, { txHash: txHash(hash) });
      if (confirmed.isOk() && confirmed.value) {
        setPublishedId(confirmed.value.id);
        setStatus("Published to Lens from Mixtape.");
        try { sessionStorage.removeItem("mixtape:pending-lens-post"); } catch { /* Optional recovery storage. */ }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("Your post was submitted. Check confirmation again shortly; do not publish a duplicate.");
  }

  async function publish(content: string) {
    if (busy || publishedId) return;
    setBusy(true);
    try {
      if (pendingHash) { await confirmPost(pendingHash); return; }
      const active = await ensureSession();
      const wallet = active.wallet;
      let hash = pendingHash;
      if (!hash) {
        setStatus("Preparing your public post…");
        const response = await fetch("/app/api/lens/metadata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
        const metadata = await response.json();
        if (!response.ok) throw new Error(metadata.error || "Could not prepare post metadata.");
        const result = await post(active.client, { contentUri: uri(metadata.contentUri), feed: evmAddress(MIXTAPE_LENS.feed) });
        if (result.isErr()) throw result.error;
        assertFreeLensOperation(result.value);
        if (result.value.__typename === "SponsoredTransactionRequest") {
          const connected = wallets.find((item) => item.address.toLowerCase() === active.signer.toLowerCase());
          if (!connected) throw new Error("Reconnect your Lens wallet.");
          await connected.switchChain(lens.id);
        }
        const operation = await handleOperationWith(wallet)(result.value);
        if (operation.isErr()) throw operation.error;
        hash = operation.value;
        setPendingHash(hash);
        setPendingContent(content);
        try { sessionStorage.setItem("mixtape:pending-lens-post", JSON.stringify({ hash, content })); } catch { /* Optional recovery storage. */ }
      }
      await confirmPost(hash);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Lens publishing failed. Your draft is still here."); }
    finally { setBusy(false); }
  }

  async function confirmChange(change: PendingChange) {
    setStatus("Change submitted. Waiting for Lens confirmation…");
    for (let attempt = 0; attempt < 12; attempt++) {
      const result = await transactionStatus(lensClient, { txHash: txHash(change.hash) });
      if (result.isOk() && result.value.__typename === "FinishedTransactionStatus") {
        setPendingChange(null);
        try { sessionStorage.removeItem("mixtape:pending-lens-change"); } catch { /* Optional recovery storage. */ }
        setStatus(change.action === "delete" ? "Post deleted." : "Post updated.");
        return true;
      }
      if (result.isOk() && result.value.__typename === "FailedTransactionStatus") {
        setPendingChange(null);
        try { sessionStorage.removeItem("mixtape:pending-lens-change"); } catch { /* Optional recovery storage. */ }
        throw new Error("Lens could not complete this change. You can try again.");
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("Change submitted. Check confirmation again; your change will not be submitted twice.");
  }

  async function act(id: string, action: "edit" | "delete" | "hype" | "unhype", content?: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      if (pendingChange) {
        if (pendingChange.id !== id || pendingChange.action !== action) throw new Error("Check your submitted change before starting another action.");
        return await confirmChange(pendingChange);
      }
      const active = await ensureSession();
      if (action === "hype" || action === "unhype") {
        const result = await (action === "hype" ? addReaction : undoReaction)(active.client, { post: postId(id), reaction: PostReactionType.Upvote });
        if (result.isErr()) throw result.error;
        if (!result.value) throw new Error("Lens could not save your reaction.");
      } else {
        let contentUri: string | undefined;
        if (action === "edit") {
          const response = await fetch("/app/api/lens/metadata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
          const metadata = await response.json();
          if (!response.ok) throw new Error(metadata.error || "Could not prepare edit.");
          contentUri = metadata.contentUri;
        }
        const result = action === "edit"
          ? await editPost(active.client, { post: postId(id), contentUri: uri(contentUri!) })
          : await deletePost(active.client, { post: postId(id) });
        if (result.isErr()) throw result.error;
        assertFreeLensOperation(result.value);
        if (result.value.__typename === "SponsoredTransactionRequest") {
          const connected = wallets.find((item) => item.address.toLowerCase() === active.signer.toLowerCase());
          if (!connected) throw new Error("Reconnect your Lens wallet.");
          await connected.switchChain(lens.id);
        }
        const operation = await handleOperationWith(active.wallet)(result.value);
        if (operation.isErr()) throw operation.error;
        const change: PendingChange = { id, action, hash: operation.value };
        setPendingChange(change);
        try { sessionStorage.setItem("mixtape:pending-lens-change", JSON.stringify(change)); } catch { /* Optional recovery storage. */ }
        await confirmChange(change);
      }
      setStatus(action === "delete" ? "Post deleted." : action === "edit" ? "Post updated." : action === "hype" ? "Hyped." : "Hype removed.");
      return true;
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not complete this action."); return false; }
    finally { setBusy(false); }
  }

  return { readClient: session?.client || lensClient, connectedAccount: session?.account, connect, wallets, walletAddress, setWalletAddress, accounts, account, setAccount, status, busy, publishedId, pendingHash, pendingContent, pendingChange, findAccounts, publish, act };
}
