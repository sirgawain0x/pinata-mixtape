# Creative Platform x402 facilitator

The Cloud Run service exposes the x402 v2 `/supported`, `/verify`, and `/settle` routes for fixed-price Base Sepolia USDC payments. Each merchant backend supplies the configured bearer token. The service accepts only EIP-3009 payments to explicitly configured recipients, up to 1 test USDC.

Store `FACILITATOR_TOKEN` and `FACILITATOR_PRIVATE_KEY` in Secret Manager and grant only the Cloud Run service identity access. Set `FACILITATOR_RECIPIENTS` to comma-separated test receiving addresses. `FACILITATOR_RPC_URL` optionally replaces the default Sepolia RPC. The dedicated signer needs Base Sepolia ETH for settlement gas. Keep the receiving wallet separate from the signer.

Deploy the Dockerfile on Cloud Run with a maximum of one instance for this pilot. The service serializes settlement requests for the gas signer and the SDK keeps its pending settlement cache in memory. Merchants retain their own durable receipts and reconcile uncertain settlements on-chain. Before increasing instances or using mainnet, implement shared settlement coordination and managed signing.

On the merchant backend, set `MIXTAPE_X402_FACILITATOR_URL` to the service URL, `MIXTAPE_X402_FACILITATOR_TOKEN` to its bearer token, and `MIXTAPE_X402_PAY_TO` to its allowed test recipient. Store the token as a server-only secret. The Cloud Run service handles caller authentication at the application layer so Vercel and other backends can invoke it.

## Deployed Sepolia pilot

- Service: `https://creative-x402-facilitator-1037240986506.us-central1.run.app`
- Gas signer: `0xB34B1EDe9675C37749cbA3659c0d546319F6a47A`
- Allowed test recipient: `0xbb0d55A46c4F369bF2b219Fdcbf4DF27dC369f77`
- Google Cloud project: `creative-ai-491118`, region `us-central1`
- Secret Manager names: `creative-x402-sepolia-signer`, `creative-x402-sepolia-token`, and `creative-x402-sepolia-recipient`. The receiving wallet key is independent and is not mounted in Cloud Run.
