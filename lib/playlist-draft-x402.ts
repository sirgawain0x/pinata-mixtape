import { HTTPFacilitatorClient } from "@x402/core/server";
import type { PaymentPayloadV2 } from "@x402/core/schemas";
import type { PaymentRequirements, SettleResponse } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createPublicClient, http, isAddress, isAddressEqual, parseAbiItem, zeroAddress, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { z } from "zod";

export const network = "eip155:84532";
const scheme = new ExactEvmScheme();
const transactionHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform((value) => value as `0x${string}`);
const address = z.string().refine((value) => isAddress(value, { strict: false })).transform((value) => value.toLowerCase() as Address);
const authorization = z.object({
  from: address,
  to: address,
  value: z.string().regex(/^\d{1,78}$/),
  validAfter: z.string().regex(/^\d{1,15}$/),
  validBefore: z.string().regex(/^\d{1,15}$/),
  nonce: transactionHash
});
const proof = z.object({
  authorization,
  signature: z.string().regex(/^0x(?:[0-9a-fA-F]{2}){1,2048}$/)
});

export async function draftPaymentConfig() {
  const payTo = process.env.MIXTAPE_X402_PAY_TO?.trim();
  if (!payTo || !isAddress(payTo, { strict: false }) || isAddressEqual(payTo, zeroAddress)) return null;
  const url = new URL(process.env.MIXTAPE_X402_FACILITATOR_URL || "https://x402.org/facilitator");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
  const price = await scheme.parsePrice("$0.05", network);
  const requirements: PaymentRequirements = {
    ...price, payTo, network, scheme: scheme.scheme, maxTimeoutSeconds: 300,
    extra: { ...price.extra, assetTransferMethod: "eip3009" }
  };
  const token = process.env.MIXTAPE_X402_FACILITATOR_TOKEN?.trim();
  if (token && url.origin === "https://x402.org") return null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  return {
    requirements,
    facilitator: new HTTPFacilitatorClient({
      url: url.href.replace(/\/$/, ""),
      timeoutMs: 15_000,
      createAuthHeaders: authHeaders
        ? async () => ({ verify: authHeaders, settle: authHeaders, supported: authHeaders })
        : undefined
    }),
    chain: createPublicClient({ chain: baseSepolia, transport: http(process.env.MIXTAPE_X402_RPC_URL, { timeout: 5000, retryCount: 0 }) })
  };
}

export function readDraftPaymentProof(payload: PaymentPayloadV2, requirements: PaymentRequirements) {
  const result = proof.safeParse(payload.payload);
  const accepted = payload.accepted;
  if (!result.success || payload.x402Version !== 2 ||
      accepted.network !== requirements.network || accepted.scheme !== requirements.scheme ||
      accepted.amount !== requirements.amount || accepted.asset.toLowerCase() !== requirements.asset.toLowerCase() ||
      accepted.payTo.toLowerCase() !== requirements.payTo.toLowerCase() ||
      accepted.maxTimeoutSeconds !== requirements.maxTimeoutSeconds ||
      accepted.extra?.name !== requirements.extra.name || accepted.extra?.version !== requirements.extra.version ||
      accepted.extra?.assetTransferMethod !== requirements.extra.assetTransferMethod) return null;
  const auth = result.data.authorization;
  if (auth.to !== requirements.payTo.toLowerCase() || auth.value !== requirements.amount ||
      Number(auth.validAfter) >= Number(auth.validBefore)) return null;
  return result.data;
}

const authorizationUsed = parseAbiItem("event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)");
const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export async function reconcileDraftSettlement(
  chain: NonNullable<Awaited<ReturnType<typeof draftPaymentConfig>>>["chain"],
  requirements: PaymentRequirements,
  auth: z.infer<typeof authorization>,
  firstBlock: bigint
): Promise<SettleResponse | undefined> {
  const latest = await chain.getBlockNumber();
  const asset = requirements.asset as Address;
  // A short-lived authorization can only settle in the blocks near its first attempt.
  // Cap the scan even when the buyer comes back weeks later.
  const lastBlock = latest < firstBlock + BigInt(999) ? latest : firstBlock + BigInt(999);
  if (lastBlock >= firstBlock) {
    const logs = await chain.getLogs({
      address: asset, event: authorizationUsed, args: { authorizer: auth.from, nonce: auth.nonce },
      fromBlock: firstBlock, toBlock: lastBlock
    });
    for (const log of logs) {
      const transfers = await chain.getLogs({
        address: asset, event: transfer,
        args: { from: auth.from, to: auth.to },
        fromBlock: log.blockNumber, toBlock: log.blockNumber
      });
      if (transfers.some((entry) => entry.transactionHash === log.transactionHash && entry.args.value === BigInt(auth.value))) {
        return { success: true, network, payer: auth.from, transaction: log.transactionHash };
      }
    }
  }
}
