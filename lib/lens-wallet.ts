/** Switch the connected wallet to Lens; surface wallet rejection instead of failing silently. */
export async function switchWalletToLensChain(
  wallet: { switchChain: (chainId: number) => Promise<unknown> },
  chainId: number
): Promise<void> {
  try {
    await wallet.switchChain(chainId);
  } catch (error) {
    const detail = error instanceof Error ? error.message.trim() : "";
    throw new Error(
      detail
        ? `Could not switch your wallet to Lens: ${detail}`
        : "Could not switch your wallet to the Lens network. Approve the network switch in your wallet and try again."
    );
  }
}
