import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { isAiGatewayConfigured } from "../lib/ai-gateway";
import { callHermesMixtapeChat, isHermesMixtapeConfigured } from "../lib/hermes-mixtape";

const savedEnv = { ...process.env };
const savedFetch = globalThis.fetch;

afterEach(() => {
  process.env = { ...savedEnv };
  globalThis.fetch = savedFetch;
});

test("isHermesMixtapeConfigured and isAiGatewayConfigured respond to HERMES_API_KEY", () => {
  delete process.env.HERMES_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.VERCEL;
  assert.equal(isHermesMixtapeConfigured(), false);
  assert.equal(isAiGatewayConfigured(), false);

  process.env.HERMES_API_KEY = "hermes-test-key";
  assert.equal(isHermesMixtapeConfigured(), true);
  assert.equal(isAiGatewayConfigured(), true);
});

test("callHermesMixtapeChat hits /v1/chat/completions with model mixtape-agent", async () => {
  process.env.HERMES_API_KEY = "hermes-test-key";
  process.env.HERMES_SWARM_URL = "https://swarm.example.com/";

  let capturedUrl = "";
  let capturedAuth = "";
  let capturedBody: Record<string, unknown> = {};

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    capturedAuth = headers.Authorization ?? "";
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        model: "mixtape-agent",
        choices: [{ message: { content: "Curated 3 tracks on Base." } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;

  const res = await callHermesMixtapeChat([{ role: "user", content: "Curate chillwave" }]);
  assert.equal(capturedUrl, "https://swarm.example.com/v1/chat/completions");
  assert.equal(capturedAuth, "Bearer hermes-test-key");
  assert.equal(capturedBody.model, "mixtape-agent");
  assert.equal(res.model, "mixtape-agent");
  assert.equal(res.content, "Curated 3 tracks on Base.");
});
