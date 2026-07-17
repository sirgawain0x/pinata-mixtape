import {
  encodeFunctionData,
  getAddress,
  type Address,
  type Hex
} from "viem";
import {
  STABLE_SWAP_FEE_TIERS,
  UNISWAP_QUOTER_V2,
  UNISWAP_SWAP_ROUTER_02
} from "./tokens";

const QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ]
      }
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" }
    ]
  }
] as const;

const SWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ]
      }
    ],
    outputs: [{ name: "amountOut", type: "uint256" }]
  }
] as const;

type QuoteClient = {
  simulateContract: (args: {
    address: Address;
    abi: typeof QUOTER_ABI;
    functionName: "quoteExactInputSingle";
    args: [
      {
        tokenIn: Address;
        tokenOut: Address;
        amountIn: bigint;
        fee: number;
        sqrtPriceLimitX96: bigint;
      }
    ];
  }) => Promise<{ result: readonly [bigint, bigint, number, bigint] }>;
};

export type SwapQuote = {
  fee: number;
  amountOut: bigint;
  amountOutMinimum: bigint;
};

/** Default 0.5% slippage for stable pairs. */
export async function quoteStableSwap(
  client: QuoteClient,
  params: {
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    slippageBps?: number;
  }
): Promise<SwapQuote> {
  const slippageBps = params.slippageBps ?? 50;
  let best: SwapQuote | null = null;

  for (const fee of STABLE_SWAP_FEE_TIERS) {
    try {
      const result = await client.simulateContract({
        address: UNISWAP_QUOTER_V2,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: getAddress(params.tokenIn),
            tokenOut: getAddress(params.tokenOut),
            amountIn: params.amountIn,
            fee,
            sqrtPriceLimitX96: BigInt(0)
          }
        ]
      });
      const amountOut = result.result[0];
      const amountOutMinimum =
        (amountOut * BigInt(10_000 - slippageBps)) / BigInt(10_000);
      if (!best || amountOut > best.amountOut) {
        best = { fee, amountOut, amountOutMinimum };
      }
    } catch {
      // try next fee tier
    }
  }

  if (!best) {
    throw new Error("No Uniswap pool quote available for this stable swap.");
  }
  return best;
}

export function encodeExactInputSingle(params: {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
}): { to: Address; data: Hex; value: bigint } {
  return {
    to: UNISWAP_SWAP_ROUTER_02,
    data: encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: getAddress(params.tokenIn),
          tokenOut: getAddress(params.tokenOut),
          fee: params.fee,
          recipient: getAddress(params.recipient),
          amountIn: params.amountIn,
          amountOutMinimum: params.amountOutMinimum,
          sqrtPriceLimitX96: BigInt(0)
        }
      ]
    }),
    value: BigInt(0)
  };
}
