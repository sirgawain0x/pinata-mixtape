"use client";

import type { useLensPublishing } from "../hooks/useLensPublishing";

export default function LensAccountPicker({ lens, locked = false }: { lens: ReturnType<typeof useLensPublishing>; locked?: boolean }) {
  return <div className="mt-lens-account-picker">
    {lens.wallets.length > 1 ? <label className="mt-post-field">Lens wallet
      <select value={lens.walletAddress} disabled={lens.busy || locked} onChange={(event) => lens.setWalletAddress(event.target.value)}>
        <option value="">Choose a connected wallet</option>
        {lens.wallets.map((wallet) => <option key={wallet.address} value={wallet.address}>{wallet.address}</option>)}
      </select>
    </label> : null}
    <button type="button" disabled={lens.busy || locked} onClick={() => void lens.findAccounts()}>Connect Lens account</button>
    {lens.accounts.length ? <label className="mt-post-field">Use Lens account
      <select value={lens.account} disabled={lens.busy || locked} onChange={(event) => lens.setAccount(event.target.value)}>
        <option value="">Choose your Lens account</option>
        {lens.accounts.map((account) => <option key={account.address} value={account.address}>{account.label}</option>)}
      </select>
    </label> : null}
    {lens.account && lens.connectedAccount !== lens.account ? <button type="button" disabled={lens.busy || locked} onClick={() => void lens.connect()}>Connect selected account</button> : null}
  </div>;
}
