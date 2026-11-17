# Mixtape x402 playlist pilot

TL;DR. An external agent can buy a completed playlist draft for 0.05 test USDC on Base Sepolia. Mixtape uses its existing Gemini playlist generator. The receiving address enables the endpoint and the facilitator URL can be replaced by a compatible x402 v2 service.

## Preview configuration

- `MIXTAPE_X402_PAY_TO` is a Creative Platform test receiving address. Leave it unset to disable the endpoint. The seller only needs the address here.
- `MIXTAPE_X402_FACILITATOR_URL` defaults to the hosted test facilitator at `https://x402.org/facilitator`. Set it to the [Creative Platform facilitator](https://creative-x402-facilitator-1037240986506.us-central1.run.app/health) for the self-hosted pilot.
- `MIXTAPE_X402_FACILITATOR_TOKEN` authenticates the Mixtape backend to that service. Use the dedicated token from Secret Manager.
- `MIXTAPE_X402_RPC_URL` can override the default Base Sepolia RPC used to recover an uncertain settlement.
- The existing AI Gateway and Turso configuration must be present for a hosted preview. Use an isolated test database for preview.

## Request

Send `POST /app/api/agent/playlist-drafts` with JSON `{"prompt":"Make a six-track sunset soul playlist"}` and a random `Idempotency-Key` containing 16–128 URL-safe characters. The `402` response advertises the x402 v2 terms in `PAYMENT-REQUIRED`. Sign those terms with a buyer wallet funded with Base Sepolia test USDC and send the same request with the `PAYMENT-SIGNATURE` header.

A successful `200` includes the draft and receipt with the transaction hash, plus `PAYMENT-RESPONSE`. For a `202`, honor `Retry-After` and reuse the original request key, body, and signed payment. A changed body or payment proof for a reserved key, or a reused authorization under another key, returns `409`. A draft with no verified recordings returns `422` without a charge. Draft generation errors can be retried with the same signed payment while it remains valid.

Mixtape writes the draft before submitting settlement. A timeout leaves the request in settlement recovery. On retry it looks for the token's authorization event and matching transfer before resubmitting the same authorization. The receipt stores the authorization identity and proof hash. Keep the original signed payment private because it also serves as proof of access to the saved draft.

Run `npm run test:payments` to check local payment and retry behavior. For the hosted test, use a funded test buyer to check the advertised chain and amount, buy a draft, and replay the signed request. The replay should return the same draft and transaction hash.
