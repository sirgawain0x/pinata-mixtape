import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  type Address,
  type Hex
} from "viem";
import { chain, getAlchemyRpcUrl } from "./chain";

export const METOKENS_DIAMOND = (process.env.NEXT_PUBLIC_METOKENS_DIAMOND || "") as Address;

export const METOKENS_ABI = [
  {
    type: "function",
    name: "getMeTokenDetails",
    stateMutability: "view",
    inputs: [{ name: "meToken", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "hubId", type: "uint256" },
          { name: "balancePooled", type: "uint256" },
          { name: "balanceLocked", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "targetHubId", type: "uint256" },
          { name: "migration", type: "address" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getHubInfo",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "endCooldown", type: "uint256" },
          { name: "refundRatio", type: "uint256" },
          { name: "targetRefundRatio", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "vault", type: "address" },
          { name: "asset", type: "address" },
          { name: "updating", type: "bool" },
          { name: "reconfigure", type: "bool" },
          { name: "active", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "meToken", type: "address" },
      { name: "assetsDeposited", type: "uint256" },
      { name: "recipient", type: "address" }
    ],
    outputs: [{ name: "meTokensMinted", type: "uint256" }]
  }
] as const;

export type MeTokenHubInfo = {
  meToken: Address;
  hubId: bigint;
  asset: Address;
  owner: Address;
};

function requireDiamond(): Address {
  if (!METOKENS_DIAMOND || !/^0x[a-fA-F0-9]{40}$/.test(METOKENS_DIAMOND)) {
    throw new Error("NEXT_PUBLIC_METOKENS_DIAMOND is not configured.");
  }
  return getAddress(METOKENS_DIAMOND);
}

export function getPublicClient() {
  return createPublicClient({
    chain,
    transport: http(getAlchemyRpcUrl())
  });
}

export async function getMeTokenHubInfo(meToken: Address): Promise<MeTokenHubInfo> {
  const diamond = requireDiamond();
  const client = getPublicClient();
  const details = await client.readContract({
    address: diamond,
    abi: METOKENS_ABI,
    functionName: "getMeTokenDetails",
    args: [getAddress(meToken)]
  });
  const hub = await client.readContract({
    address: diamond,
    abi: METOKENS_ABI,
    functionName: "getHubInfo",
    args: [details.hubId]
  });
  return {
    meToken: getAddress(meToken),
    hubId: details.hubId,
    asset: getAddress(hub.asset),
    owner: getAddress(details.owner)
  };
}

export function encodeMintCall(params: {
  meToken: Address;
  assetsDeposited: bigint;
  recipient: Address;
}): { to: Address; data: Hex; value: bigint } {
  return {
    to: requireDiamond(),
    data: encodeFunctionData({
      abi: METOKENS_ABI,
      functionName: "mint",
      args: [getAddress(params.meToken), params.assetsDeposited, getAddress(params.recipient)]
    }),
    value: BigInt(0)
  };
}

export function encodeApproveCall(params: {
  token: Address;
  spender: Address;
  amount: bigint;
}): { to: Address; data: Hex; value: bigint } {
  const erc20ApproveAbi = [
    {
      type: "function",
      name: "approve",
      stateMutability: "nonpayable",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [{ name: "", type: "bool" }]
    }
  ] as const;
  return {
    to: getAddress(params.token),
    data: encodeFunctionData({
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [getAddress(params.spender), params.amount]
    }),
    value: BigInt(0)
  };
}
