import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import { PaymentPayloadV2Schema } from "@x402/core/schemas";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { keccak256, stringToHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { POST } from "../app/api/agent/playlist-drafts/route";
import { getSqliteDatabase } from "../lib/db";
import {
  claimDraftPayment, paymentHash, releaseDraftPayment, reserveDraftPayment, saveGeneratedDraft
} from "../lib/playlist-draft-payments";
import { draftPaymentConfig, readDraftPaymentProof } from "../lib/playlist-draft-x402";

test("Sepolia x402 quotes, reserves once, settles once, and recovers the same draft", async (t) => {
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.VERCEL;
  delete process.env.MIXTAPE_X402_PAY_TO;
  const originalDirectory = process.cwd();
  const directory = await mkdtemp(path.join(tmpdir(), "playlist-payments-"));
  process.chdir(directory);
  t.after(async () => {
    getSqliteDatabase().close();
    process.chdir(originalDirectory);
    await rm(directory, { recursive: true, force: true });
  });
  const key = "a-random-idempotency-key";
  const prompt = "Make a sunset soul playlist";
  const request = (id = key, signature?: string, text = prompt) => new Request("https://mixtape.example/app/api/agent/playlist-drafts", {
    method: "POST",
    body: JSON.stringify({ prompt: text }),
    headers: { "Idempotency-Key": id, ...(signature ? { "PAYMENT-SIGNATURE": signature } : {}) }
  });

  assert.equal((await POST(request())).status, 503);
  process.env.MIXTAPE_X402_PAY_TO = "0x0000000000000000000000000000000000000123";
  process.env.MIXTAPE_X402_FACILITATOR_URL = "https://facilitator.example";
  process.env.MIXTAPE_X402_RPC_URL = "https://rpc.example";
  process.env.AI_GATEWAY_API_KEY = "fixture";
  const quote = await POST(request());
  assert.equal(quote.status, 402);
  const required = decodePaymentRequiredHeader(quote.headers.get("PAYMENT-REQUIRED")!);
  assert.equal(required.accepts[0].network, "eip155:84532");
  assert.equal(required.accepts[0].amount, "50000");

  const signer = privateKeyToAccount(generatePrivateKey());
  const client = registerExactEvmScheme(new x402Client(), { signer, networks: ["eip155:84532"] });
  const payload = await client.createPaymentPayload(required);
  const signature = encodePaymentSignatureHeader(payload);
  const requirements = (await draftPaymentConfig())!.requirements;
  const proof = readDraftPaymentProof(PaymentPayloadV2Schema.parse(payload), requirements)!;
  const auth = proof.authorization;
  const authorizationId = paymentHash(requirements.network, requirements.asset.toLowerCase(), auth.from, auth.nonce.toLowerCase());
  const args = {
    id: key, requestHash: paymentHash(prompt), authorizationId,
    proofHash: paymentHash(authorizationId, JSON.stringify(auth), proof.signature.toLowerCase()),
    payer: auth.from, requirements
  };
  const reservations = await Promise.all([
    reserveDraftPayment(args),
    reserveDraftPayment(args),
    reserveDraftPayment({ ...args, id: "another-idempotency-key" })
  ]);
  assert.equal(reservations.filter(Boolean).length, 1);
  const initial = reservations[0]!;
  assert.equal((await POST(request(key, signature))).status, 202);
  await releaseDraftPayment(initial);
  const generation = await claimDraftPayment(initial, "generating");
  assert.ok(generation);
  assert.equal(await saveGeneratedDraft(initial, { title: "Stale" }), undefined);
  const draft = { title: "Sunset Soul", tracks: [{ title: "Track", artist: "Artist", musicbrainzId: "verified-fixture" }] };
  assert.equal((await saveGeneratedDraft(generation, draft))?.status, "ready");

  let settlements = 0;
  let broadcasts = 0;
  const transaction = `0x${"a".repeat(64)}`;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
    const target = String(url);
    if (target === "https://rpc.example/") {
      const rpc = JSON.parse(String(options?.body));
      let result: unknown = "0x10";
      if (rpc.method === "eth_getLogs") {
        const token = requirements.asset;
        const addressTopic = (value: string) => `0x${value.slice(2).padStart(64, "0")}`;
        const baseLog = { address: token, blockNumber: "0x10", transactionHash: transaction,
          blockHash: `0x${"b".repeat(64)}`, transactionIndex: "0x0", logIndex: "0x0", removed: false };
        const selector = rpc.params[0].topics[0];
        const isAuthorization = selector === keccak256(stringToHex("AuthorizationUsed(address,bytes32)"));
        result = !broadcasts ? [] : isAuthorization
          ? [{ ...baseLog, topics: [selector, addressTopic(auth.from), auth.nonce], data: "0x" }]
          : [{ ...baseLog, topics: [selector, addressTopic(auth.from), addressTopic(auth.to)],
            data: `0x${BigInt(auth.value).toString(16).padStart(64, "0")}` }];
      } else assert.equal(rpc.method, "eth_blockNumber");
      return Response.json({ jsonrpc: "2.0", id: rpc.id, result });
    }
    if (target === "https://facilitator.example/verify") return Response.json({ isValid: true, payer: auth.from });
    assert.equal(target, "https://facilitator.example/settle");
    settlements++;
    broadcasts++;
    throw new Error("Connection lost after broadcast");
  });

  const responses = await Promise.all([POST(request(key, signature)), POST(request(key, signature))]);
  assert.ok(responses.every((response) => response.status === 202));
  const database = getSqliteDatabase();
  database.prepare("UPDATE playlist_draft_payments SET lease_until = 0 WHERE id = ?").run(key);
  const recovered = await POST(request(key, signature));
  assert.equal(recovered.status, 200);
  assert.equal(decodePaymentResponseHeader(recovered.headers.get("PAYMENT-RESPONSE")!).transaction, transaction);
  assert.deepEqual((await recovered.json()).draft, draft);
  assert.equal((await POST(request(key, signature, "different brief"))).status, 409);
  assert.equal((await POST(request("another-idempotency-key", signature))).status, 409);
  assert.equal((await POST(request(key, signature))).status, 200);
  const declinedKey = "declined-idempotency-key";
  const declinedPayload = await client.createPaymentPayload(required);
  const declinedProof = readDraftPaymentProof(PaymentPayloadV2Schema.parse(declinedPayload), requirements)!;
  const declinedAuthorizationId = paymentHash(requirements.network, requirements.asset.toLowerCase(),
    declinedProof.authorization.from, declinedProof.authorization.nonce.toLowerCase());
  const declining = await reserveDraftPayment({ ...args, id: declinedKey, authorizationId: declinedAuthorizationId,
    proofHash: paymentHash(declinedAuthorizationId, JSON.stringify(declinedProof.authorization), declinedProof.signature.toLowerCase()) });
  assert.ok(declining);
  await saveGeneratedDraft(declining, null);
  assert.equal((await POST(request(declinedKey, encodePaymentSignatureHeader(declinedPayload)))).status, 422);
  assert.equal(settlements, 1);
});
