import type { Address } from "viem";

/** Base mainnet defaults — override via env when needed. */
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as Address;

export const USDS_ADDRESS = (process.env.NEXT_PUBLIC_USDS_ADDRESS ||
  "0x820C137faEFdf8d4B337aa6957FA1A8ca1E04003") as Address;

export const GHO_ADDRESS = (process.env.NEXT_PUBLIC_GHO_ADDRESS ||
  "0x6Bb7a212910682DCFdbd5BCBb3e28FB4E8da10Ee") as Address;

export const UNISWAP_SWAP_ROUTER_02 = (process.env.NEXT_PUBLIC_UNISWAP_SWAP_ROUTER ||
  "0x2626664c2603336E57B271c5C0b26F421741e481") as Address;

export const UNISWAP_QUOTER_V2 = (process.env.NEXT_PUBLIC_UNISWAP_QUOTER_V2 ||
  "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a") as Address;

/** Prefer 0.05% pools for stable→stable; fall back to 0.3%. */
export const STABLE_SWAP_FEE_TIERS = [500, 3000, 100] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  }
] as const;

export function tokenSymbol(address: Address): string {
  const lower = address.toLowerCase();
  if (lower === USDC_ADDRESS.toLowerCase()) return "USDC";
  if (lower === USDS_ADDRESS.toLowerCase()) return "USDS";
  if (lower === GHO_ADDRESS.toLowerCase()) return "GHO";
  return "TOKEN";
}

export function isUsdc(address: Address): boolean {
  return address.toLowerCase() === USDC_ADDRESS.toLowerCase();
}
