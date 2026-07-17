import { base, baseSepolia } from "viem/chains";

export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453);
export const chain = chainId === 84532 ? baseSepolia : base;
export const isBaseSepolia = chainId === 84532;

const alchemyKey =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY || "";

export function getAlchemyRpcUrl(): string {
  if (process.env.ALCHEMY_RPC_URL) return process.env.ALCHEMY_RPC_URL;
  const network = isBaseSepolia ? "base-sepolia" : "base-mainnet";
  const key = alchemyKey || "PLACEHOLDER_VALUE_NOT_SET";
  return `https://${network}.g.alchemy.com/v2/${key}`;
}

export const alchemyPolicyId = process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID;
