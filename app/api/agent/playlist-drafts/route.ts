import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader, readLimitedText } from "@x402/core/http";
import { PaymentPayloadV2Schema } from "@x402/core/schemas";
import { SettleError, VerifyError, type PaymentRequirements, type SettleResponse } from "@x402/core/types";
import { z } from "zod";
import { createPlaylistDraft } from "../../../../lib/playlist-agent";
import {
  claimDraftPayment, findDraftPayment, paymentHash, recordSettlementStart, releaseDraftPayment,
  reserveDraftPayment, saveDraftSettlement, saveGeneratedDraft, type DraftPayment
} from "../../../../lib/playlist-draft-payments";
import { draftPaymentConfig, readDraftPaymentProof, reconcileDraftSettlement } from "../../../../lib/playlist-draft-x402";
import { clientLimiterKey, rateLimitHit } from "../../../../lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const briefSchema = z.object({ prompt: z.string().trim().min(1).max(4000) }).strict();
const keyPattern = /^[A-Za-z0-9_-]{16,128}$/;
const minimumAuthorizationSeconds = 105;
const transactionPattern = /^0x[0-9a-fA-F]{64}$/;

function json(body: object, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...headers, "Cache-Control": "no-store" } });
}

function pending() {
  return json({ status: "pending", message: "Retry with the same request and payment." }, 202, { "Retry-After": "5" });
}

function conflict() {
  return json({ error: "The request key or payment authorization is already in use." }, 409);
}

function decline() {
  return json({ error: "No complete draft was produced. Start a new request with a more specific brief." }, 422);
}

function paid(payment: DraftPayment) {
  const settlement: SettleResponse = JSON.parse(payment.settlement!);
  const requirements: PaymentRequirements = JSON.parse(payment.requirements);
  return json({
    draft: JSON.parse(payment.draft!),
    receipt: {
      id: payment.id, payer: payment.payer, transaction: settlement.transaction,
      network: requirements.network, asset: requirements.asset, amount: requirements.amount
    }
  }, 200, { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settlement) });
}

export async function POST(request: Request) {
  try {
    return await handleRequest(request);
  } catch {
    return json({ error: "The playlist payment service is temporarily unavailable. Retry the same request." }, 503);
  }
}

async function handleRequest(request: Request) {
  const config = await draftPaymentConfig();
  if (!config) return json({ error: "The Base Sepolia playlist payment pilot is disabled." }, 503);
  const id = request.headers.get("Idempotency-Key") ?? "";
  if (!keyPattern.test(id)) return json({ error: "Provide a random Idempotency-Key of 16 to 128 URL-safe characters." }, 400);
  let input;
  try {
    input = briefSchema.safeParse(JSON.parse(await readLimitedText(new Response(request.body), 24_000)));
  } catch {
    return json({ error: "Send a JSON object with a short playlist prompt." }, 400);
  }
  if (!input.success) return json({ error: "Provide a playlist prompt of up to 4,000 characters." }, 400);
  const requestHash = paymentHash(input.data.prompt);
  const paymentHeader = request.headers.get("PAYMENT-SIGNATURE");
  const { facilitator, chain } = config;
  const currentRequirements = config.requirements;
  const resource = {
    url: new URL("/app/api/agent/playlist-drafts", request.url).href,
    description: "One playlist draft with MusicBrainz-verified tracks",
    mimeType: "application/json"
  };
  function quote(error = "Payment required") {
    return json({ error }, 402, { "PAYMENT-REQUIRED": encodePaymentRequiredHeader({
      x402Version: 2, error, resource, accepts: [currentRequirements]
    }) });
  }
  if (!paymentHeader) return quote();
  if (paymentHeader.length > 8192) return json({ error: "Payment proof is too large." }, 400);
  let decoded;
  try {
    decoded = PaymentPayloadV2Schema.safeParse(decodePaymentSignatureHeader(paymentHeader));
  } catch {
    return json({ error: "Invalid x402 payment header." }, 400);
  }
  if (!decoded.success) return json({ error: "Invalid x402 payment header." }, 400);
  let payment = await findDraftPayment(id);
  const requirements: PaymentRequirements = payment ? JSON.parse(payment.requirements) : currentRequirements;
  const proof = readDraftPaymentProof(decoded.data, requirements);
  if (!proof) return payment ? conflict() : quote("Payment does not match the quote.");
  const { authorization } = proof;
  const authorizationId = paymentHash(requirements.network, requirements.asset.toLowerCase(), authorization.from, authorization.nonce.toLowerCase());
  const proofHash = paymentHash(authorizationId, JSON.stringify(authorization), proof.signature.toLowerCase());
  const payload = { x402Version: 2, accepted: requirements, resource, payload: proof };
  function matches(row: DraftPayment) {
    return row.request_hash === requestHash && row.authorization_id === authorizationId && row.proof_hash === proofHash;
  }
  if (payment && !matches(payment)) return conflict();
  if (payment?.status === "paid") return paid(payment);
  if (payment?.status === "declined") return decline();

  function hasTimeToGenerate() {
    const remaining = Number(authorization.validBefore) - Date.now() / 1000;
    return remaining >= minimumAuthorizationSeconds && remaining <= requirements.maxTimeoutSeconds + 30;
  }

  async function verify() {
    try {
      const result = await facilitator.verify(payload, requirements);
      return result.isValid && result.payer?.toLowerCase() === authorization.from;
    } catch (error) {
      if (error instanceof VerifyError) return false;
      throw error;
    }
  }

  let ownsGeneration = false;
  if (!payment) {
    if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
      return json({ error: "The playlist generator is temporarily unavailable." }, 503);
    }
    if (!rateLimitHit(`playlist-payment:${clientLimiterKey(request)}`, 20, 60_000)) {
      return json({ error: "Too many payment attempts. Try again shortly." }, 429, { "Retry-After": "60" });
    }
    if (!hasTimeToGenerate() || !await verify()) {
      return quote("A valid authorization with at least 105 seconds remaining is required.");
    }
    payment = await reserveDraftPayment({ id, requestHash, authorizationId, proofHash, payer: authorization.from, requirements });
    ownsGeneration = Boolean(payment);
    if (!payment) {
      payment = await findDraftPayment(id);
      if (!payment || !matches(payment)) return conflict();
    }
  }

  if (payment.status === "generating") {
    if (!ownsGeneration) {
      if (payment.lease_until > Date.now()) return pending();
      if (!hasTimeToGenerate() || !await verify()) {
        return json({ error: "The payment authorization expired or is no longer valid. Start a new request." }, 422);
      }
      const claimed = await claimDraftPayment(payment, "generating");
      if (!claimed) return pending();
      payment = claimed;
    }
    let result;
    try {
      result = await createPlaylistDraft([{ role: "user", content:
        `Produce a playlist draft with at least one verified recording. Infer any missing optional details. Playlist brief: ${input.data.prompt}`
      }]);
    } catch {
      await releaseDraftPayment(payment, 5000);
      return json({ error: "Draft generation failed. Retry the same request." }, 503, { "Retry-After": "5" });
    }
    const draft = result.draft?.tracks?.length ? result.draft : null;
    const saved = await saveGeneratedDraft(payment, draft);
    if (!saved) return pending();
    payment = saved;
  }

  if (payment.status === "declined") return decline();
  if (payment.status === "paid") return paid(payment);
  if (payment.lease_until > Date.now()) return pending();
  const claimed = await claimDraftPayment(payment, "settling");
  if (!claimed) return pending();

  let settlement: SettleResponse | undefined;
  if (claimed.settlement_block) {
    settlement = await reconcileDraftSettlement(chain, requirements, authorization, BigInt(claimed.settlement_block));
  } else if (!await recordSettlementStart(claimed, await chain.getBlockNumber())) {
    return pending();
  }

  if (!settlement) {
    // A broadcast may have succeeded even if the facilitator's response was lost.
    // Never ask for a fresh payment while the original settlement is uncertain.
    if (Number(authorization.validBefore) <= Date.now() / 1000) {
      if (Number(authorization.validBefore) + 120 > Date.now() / 1000) {
        await releaseDraftPayment(claimed, 5000);
        return pending();
      }
      await releaseDraftPayment(claimed, 5000);
      return json({ error: "The authorization expired and no settlement was found." }, 422);
    }
    try {
      settlement = await facilitator.settle(payload, requirements);
    } catch (error) {
      if (error instanceof SettleError) {
        settlement = { success: false, errorReason: error.errorReason,
          network: error.network, payer: error.payer, transaction: error.transaction };
      }
      else {
        await releaseDraftPayment(claimed, 5000);
        return pending();
      }
    }
  }

  const confirmed = settlement.success === true && settlement.network === requirements.network &&
    settlement.payer?.toLowerCase() === authorization.from && transactionPattern.test(settlement.transaction);
  const saved = await saveDraftSettlement(claimed, settlement, confirmed);
  return confirmed && saved ? paid(saved) : pending();
}
