import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { x402Facilitator } from "@x402/core/facilitator";
import { PaymentPayloadV2Schema, PaymentRequirementsV2Schema } from "@x402/core/schemas";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { createPublicClient, createWalletClient, http, isAddress, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const network = "eip155:84532";
const usdc = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
const { FACILITATOR_TOKEN, FACILITATOR_PRIVATE_KEY, FACILITATOR_RPC_URL, FACILITATOR_RECIPIENTS } = process.env;
const recipients = new Set(FACILITATOR_RECIPIENTS?.split(",").map((address) => address.trim().toLowerCase()));
if (!FACILITATOR_TOKEN || FACILITATOR_TOKEN.length < 32 ||
    !/^0x[0-9a-fA-F]{64}$/.test(FACILITATOR_PRIVATE_KEY ?? "") ||
    !recipients.size || [...recipients].some((address) => address === zeroAddress || !isAddress(address))) {
  throw new Error("Configure the facilitator token, dedicated Sepolia signer, and allowed recipients.");
}

const digest = (value) => createHash("sha256").update(value).digest();
const expectedToken = digest(`Bearer ${FACILITATOR_TOKEN}`);
const account = privateKeyToAccount(FACILITATOR_PRIVATE_KEY);
const transport = http(FACILITATOR_RPC_URL, { timeout: 5000, retryCount: 0 });
const publicClient = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ chain: baseSepolia, transport, account });
if (await publicClient.getChainId() !== baseSepolia.id) throw new Error("The facilitator RPC must serve Base Sepolia.");
const signer = toFacilitatorEvmSigner({
  address: account.address,
  readContract: publicClient.readContract,
  verifyTypedData: publicClient.verifyTypedData,
  getCode: publicClient.getCode,
  waitForTransactionReceipt: publicClient.waitForTransactionReceipt,
  writeContract: wallet.writeContract,
  sendTransaction: wallet.sendTransaction
}, { confirmationTimeoutMs: 8000 });
const facilitator = new x402Facilitator().register(network, new ExactEvmScheme(signer));

function allowed(requirements) {
  return requirements.network === network && requirements.scheme === "exact" &&
    requirements.asset.toLowerCase() === usdc && recipients.has(requirements.payTo.toLowerCase()) &&
    /^\d{1,7}$/.test(requirements.amount) && Number(requirements.amount) > 0 &&
    Number(requirements.amount) <= 1_000_000 &&
    requirements.extra?.assetTransferMethod === "eip3009";
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

let settlementRunning = false;
const server = createServer(async (request, response) => {
  const reply = (status, body) => {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(body));
  };
  if (request.method === "GET" && request.url === "/health") return reply(200, { ok: true });
  if (!timingSafeEqual(expectedToken, digest(request.headers.authorization ?? ""))) {
    return reply(401, { error: "Unauthorized" });
  }
  if (request.method === "GET" && request.url === "/supported") return reply(200, facilitator.getSupported());
  if (request.method !== "POST" || !["/verify", "/settle"].includes(request.url)) {
    return reply(404, { error: "Unknown facilitator endpoint" });
  }
  let body;
  try { body = await readBody(request); } catch { return reply(400, { error: "Invalid request body" }); }
  const payload = PaymentPayloadV2Schema.safeParse(body?.paymentPayload);
  const requirements = PaymentRequirementsV2Schema.safeParse(body?.paymentRequirements);
  if (body?.x402Version !== 2 || !payload.success || !requirements.success ||
      !allowed(requirements.data) || !allowed(payload.data.accepted) ||
      typeof payload.data.payload.signature !== "string" || !payload.data.payload.authorization ||
      "permit2Authorization" in payload.data.payload) {
    return reply(400, { error: "Unsupported payment requirements" });
  }
  const canonical = { ...requirements.data, extra: requirements.data.extra ?? {} };
  try {
    if (request.url === "/verify") return reply(200, await facilitator.verify(payload.data, canonical));
    if (settlementRunning) return reply(429, { error: "Settlement is busy. Retry the same payment." });
    settlementRunning = true;
    try {
      return reply(200, await facilitator.settle(payload.data, canonical));
    } finally {
      settlementRunning = false;
    }
  } catch {
    return reply(503, { error: "Facilitator temporarily unavailable" });
  }
});
server.requestTimeout = 20_000;
server.listen(Number(process.env.PORT ?? "8080"), "0.0.0.0");
